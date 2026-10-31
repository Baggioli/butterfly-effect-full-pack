#!/usr/bin/env python3
"""从 salary_reference.xlsx 导入 → data/income-params.csv。
支持：可变分位（南京 P10/P50/P90）、省级样本（武汉/长沙）、区域样本（川渝）、
北京 L2 职业→行业均值。p25/p50/p75 存低/中/高数值；percentile* 与 bandLabel 标明实际分位。
"""
import csv, json, re, sys
from pathlib import Path
from urllib.parse import urlparse
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/workspace/butterfly-pm/salary_reference.xlsx")
LEDGER = ROOT / "data" / "salary_source_ledger.csv"
OUT = ROOT / "data" / "income-params.csv"

CITY_PROVINCE = {
  "深圳":"广东","广州":"广东","东莞":"广东","佛山":"广东","珠海":"广东",
  "宁波":"浙江","杭州":"浙江","温州":"浙江","郑州":"河南","洛阳":"河南",
  "北京":"北京","上海":"上海","天津":"天津","重庆":"重庆","成都":"四川",
  "武汉":"湖北","南京":"江苏","苏州":"江苏","西安":"陕西","长沙":"湖南",
  "合肥":"安徽","青岛":"山东","济南":"山东","厦门":"福建","福州":"福建",
}
CITY_REGION = {"成都":"川渝","重庆":"川渝"}
# 有省级/区域「≠单市」样本的城市：不写 L3 应届城市混合行，避免盖过省级/区域 L1
SKIP_CITY_YINGJIE = {"武汉", "长沙", "成都", "重庆"}
COLS = ["city","province","scope","occupation","officialName","p25","p50","p75","mean",
        "percentileLow","percentileMid","percentileHigh","bandLabel","sampleLabel","industryName",
        "metric","dataYear","sourceTier","sourceLedgerId","sourceUrl","expCoefVersion",
        "internalMarker","note"]
KNOWN_OCC = {"程序员/前端","数据分析","UI/平面设计","CPA/会计","法考/律师助理/律师",
             "人力资源","销售","互联网运营","教师"}

def num(x):
  if x is None: return None
  s = str(x).replace(",","").replace("—","").replace("–","-")
  if "无数据" in str(x) or s.strip() in ("", "-"): return None
  m = re.search(r"(\d+(?:\.\d+)?)", s)
  return float(m.group(1)) if m else None

def parse_cell(x):
  """Return (value, percentile_or_None) from e.g. '7,852（P10/低）' or '13,230（P50/中）'."""
  if x is None: return None, None
  s = str(x)
  if "无数据" in s or s.strip() in ("", "—", "-"): return None, None
  v = num(s)
  pct = None
  m = re.search(r"P\s*(\d+)", s, re.I)
  if m: pct = int(m.group(1))
  elif "50分位" in s or "中位" in s: pct = 50
  elif "75分位" in s: pct = 75
  elif "25分位" in s: pct = 25
  return v, pct

def band_range(s):
  if s is None: return None
  t = str(s).replace(",","")
  m = re.search(r"(\d+)\s*[–\-]\s*(\d+)", t)
  return [int(m.group(1)), int(m.group(2))] if m else None

def occ_key(label):
  s = str(label or "")
  if "→" in s: s = s.split("→")[0]
  s = re.sub(r"^【L[123]】", "", s).strip()
  if s in ("法考/律师", "律师", "律师助理"):
    s = "法考/律师助理/律师"
  return s

def expand_occs(label):
  """Handle combined keys like 'CPA/会计·人力资源→…'."""
  head = str(label or "").split("→")[0]
  head = re.sub(r"^【L[123]】", "", head).strip()
  if "·" in head or "、" in head:
    parts = re.split(r"[·、]", head)
    out = []
    for p in parts:
      k = occ_key(p.strip())
      if k in KNOWN_OCC: out.append(k)
      elif "会计" in p: out.append("CPA/会计")
      elif "人力" in p: out.append("人力资源")
      elif "法" in p: out.append("法考/律师助理/律师")
    return out or ([occ_key(label)] if occ_key(label) in KNOWN_OCC else [])
  k = occ_key(label)
  return [k] if k in KNOWN_OCC else []

def detect_percentiles(c_lo, c_mid, c_hi, metric, city):
  """Infer percentileLow/Mid/High and bandLabel from cell annotations + metric."""
  _, pl = parse_cell(c_lo)
  _, pm = parse_cell(c_mid)
  _, ph = parse_cell(c_hi)
  blob = " ".join(str(x or "") for x in (c_lo, c_mid, c_hi, metric))
  if pl is None and ph is None:
    if "P10" in blob and "P90" in blob:
      pl, pm, ph = 10, 50, 90
    elif "P25" in blob and "P75" in blob:
      pl, pm, ph = 25, 50, 75
    elif city == "南京":
      pl, pm, ph = 10, 50, 90
    else:
      pl, pm, ph = 25, 50, 75
  else:
    pl = pl if pl is not None else 25
    pm = pm if pm is not None else 50
    ph = ph if ph is not None else 75
  if pl == 10 and ph == 90:
    label = "P10–P90（低–高）"
  elif pl == 25 and ph == 75:
    label = "P25–P75"
  else:
    label = f"P{pl}–P{ph}"
  return pl, pm, ph, label

def norm_tier(t):
  t = str(t or "").strip()
  if t.startswith("L1"): return "L1", t
  if t.startswith("L2"): return "L2", t
  if t.startswith("L3"): return "L3", t
  return None, t

def load_ledger():
  rows = list(csv.DictReader(LEDGER.open(encoding="utf-8")))
  return {r["url"]: r for r in rows if r.get("url")}, rows

def ledger_for(by_url, url):
  u = str(url or "").split("；")[0].split(";")[0].strip()
  if not u: return None
  if u in by_url: return by_url[u]
  # http/https normalize
  variants = {u}
  if u.startswith("http://"): variants.add("https://" + u[7:])
  if u.startswith("https://"): variants.add("http://" + u[8:])
  for v in variants:
    if v in by_url: return by_url[v]
  for k, v in by_url.items():
    try:
      a, b = urlparse(u), urlparse(k)
      if a.netloc.replace("www.","") == b.netloc.replace("www.","") and a.path.rstrip("/") == b.path.rstrip("/"):
        return v
    except Exception:
      pass
    if len(u) > 20 and (k.startswith(u[:55]) or u.startswith(k[:55])):
      return v
  return None

def industry_from_label(label):
  """Extract industry name from '职业→L2行业：信息传输…'."""
  s = str(label or "")
  for sep in ("L2行业：", "L2行业映射：", "→"):
    if sep in s:
      tail = s.split(sep)[-1]
      tail = re.sub(r"（.*?）", "", tail).strip()
      return tail or s
  return s

def main():
  by_url, _ = load_ledger()
  wb = openpyxl.load_workbook(XLSX, data_only=True)
  raw = []

  # ---- 薪资参照（深圳/广州/宁波/郑州 等主表）----
  ws = wb["薪资参照"]
  for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 2: continue
    if not row[0]: continue
    d = str(row[0])
    if d.startswith("说明"): break
    if d.startswith("通用参照"): continue
    b = band_range(row[4])
    if not b: continue
    city = str(row[2] or "").strip()
    official = str(row[3] or "").strip()
    url = str(row[5] or "").strip()
    year = str(row[6] or "").strip()
    tier = str(row[17] or "L1").strip() or "L1"
    if tier not in ("L1","L2","L3"): continue
    note = str(row[16] or ""); marker = str(row[18] or "")
    q = re.search(r"P10/P25/P50/P75/P90=([\d,/]+)", note)
    p50 = ""
    if q:
      parts = [int(x.replace(",","")) for x in q.group(1).split("/")]
      if len(parts) >= 3: p50 = round(parts[2] / 12)
    # 分位：南京主表常为 P10/P50/P90（低/中/高）；其余默认 P25/P50/P75
    if "P10" in note and "P90" in note or city == "南京":
      pl, pm, ph, bl = 10, 50, 90, "P10–P90（低–高）"
    else:
      pl, pm, ph, bl = 25, 50, 75, "P25–P75"
    # 从备注补 P50：年低/中/高=a/b/c 或 P10/P25/P50/P75/P90=…
    if not p50:
      m_mid = re.search(r"年低/中/高\s*=\s*[\d,]+/([\d,]+)/", note)
      if m_mid: p50 = round(int(m_mid.group(1).replace(",","")) / 12)
    metric = f"企业在岗职工全年应发工资（税前）；月薪=年值÷12；{bl}"
    raw.append(dict(sheet="薪资参照", city=city, occupation=d, officialName=official,
      p25=b[0], p50=p50, p75=b[1], mean="", percentileLow=pl, percentileMid=pm, percentileHigh=ph,
      bandLabel=bl, sampleLabel="", industryName="",
      metric=metric, dataYear=year, sourceTier=tier, sourceUrl=url,
      internalMarker=marker, note=note, scope="city", province=CITY_PROVINCE.get(city,"")))

  # ---- 补充-其他城市 + 省级/区域 ----
  ws = wb["补充-其他城市"]
  for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    city_raw = str(row[0] or "").strip()
    if not city_raw: continue
    label = str(row[1] or "")
    # skip empty / 无数据
    v_lo, _ = parse_cell(row[2]); v_mid, _ = parse_cell(row[3]); v_hi, _ = parse_cell(row[4])
    tier, tier_raw = norm_tier(row[7])
    if not tier: continue
    metric = str(row[5] or "")
    year = str(row[6] or "")
    url = str(row[8] or "")
    note = str(row[10] or "")
    marker = str(row[11] or "")

    # L3 应届生起薪（P50–P75）→ 复制到各已知职业
    if tier == "L3" and "应届" in label and v_mid and v_hi and v_mid < v_hi:
      city = city_raw
      if city not in CITY_PROVINCE: continue
      if city in SKIP_CITY_YINGJIE: continue  # 走省级/区域 ≠单市
      pl, pm, ph, bl = 50, 50, 75, "P50–P75（应届起薪）"
      for occ in KNOWN_OCC:
        raw.append(dict(sheet="补充-其他城市", city=city, occupation=occ,
          officialName="2025届应届生起薪（城市混合）",
          p25=int(v_mid), p50=int(v_mid), p75=int(v_hi), mean="",
          percentileLow=pl, percentileMid=pm, percentileHigh=ph, bandLabel=bl,
          sampleLabel="", industryName="",
          metric=metric or "应届起薪分位（招聘平台公开报告）", dataYear=year, sourceTier="L3",
          sourceUrl=url, internalMarker=marker, note=note, scope="city",
          province=CITY_PROVINCE[city]))
      continue

    if v_lo is None or v_hi is None or not (v_lo < v_hi):
      continue

    # 川渝区域
    if "川渝" in city_raw:
      occs = expand_occs(label)
      if not occs:
        # combined CPA/会计·人力资源
        occs = expand_occs(label)
      official = label.split("→", 1)[1].strip() if "→" in label else label
      pl, pm, ph, bl = detect_percentiles(row[2], row[3], row[4], metric, "")
      for occ in occs:
        raw.append(dict(sheet="补充-其他城市", city="", occupation=occ, officialName=official,
          p25=int(v_lo), p50=int(v_mid) if v_mid else "", p75=int(v_hi), mean="",
          percentileLow=pl, percentileMid=pm, percentileHigh=ph, bandLabel=bl,
          sampleLabel="区域样本 ≠ 单市", industryName="",
          metric=metric or "税前应发；川渝联合企业样本", dataYear=year, sourceTier="L1",
          sourceUrl=url, internalMarker=marker, note=note or tier_raw,
          scope="region", province="川渝", region="川渝"))
      continue

    # 湖南省省级兜底
    if "湖南" in city_raw and ("省级" in city_raw or "省级" in tier_raw):
      occs = expand_occs(label)
      if not occs: continue
      official = label.split("→", 1)[1].strip() if "→" in label else label
      pl, pm, ph, bl = detect_percentiles(row[2], row[3], row[4], metric, "")
      # Prefer finer S class over 中类 for same occ — keep both, later dedupe prefers first finer
      raw.append(dict(sheet="补充-其他城市", city="", occupation=occs[0], officialName=official,
        p25=int(v_lo), p50=int(v_mid) if v_mid else "", p75=int(v_hi), mean="",
        percentileLow=pl, percentileMid=pm, percentileHigh=ph, bandLabel=bl,
        sampleLabel="省级样本 ≠ 单市", industryName="",
        metric=metric or "税前应发；湖南省企业样本", dataYear=year, sourceTier="L1",
        sourceUrl=url, internalMarker=marker, note=note or tier_raw,
        scope="province", province="湖南"))
      continue

    # 武汉省级样本（标武汉行）
    if city_raw == "武汉" and ("省级" in tier_raw or "≠" in metric or "省级" in metric):
      occs = expand_occs(label)
      if not occs: continue
      official = label.split("→", 1)[1].strip() if "→" in label else label
      pl, pm, ph, bl = detect_percentiles(row[2], row[3], row[4], metric, "武汉")
      raw.append(dict(sheet="补充-其他城市", city="", occupation=occs[0], officialName=official,
        p25=int(v_lo), p50=int(v_mid) if v_mid else "", p75=int(v_hi), mean="",
        percentileLow=pl, percentileMid=pm, percentileHigh=ph, bandLabel=bl,
        sampleLabel="省级样本 ≠ 单市", industryName="",
        metric=metric or "税前应发；湖北省级企业样本（≠武汉单市）", dataYear=year, sourceTier="L1",
        sourceUrl=url, internalMarker=marker, note=note or tier_raw,
        scope="province", province="湖北"))
      continue

    # 普通单市 L1（西安/东莞/青岛/佛山/合肥/天津/南京/…）
    if city_raw not in CITY_PROVINCE: continue
    occs = expand_occs(label)
    if not occs: continue
    official = label.split("→", 1)[1].strip() if "→" in label else occs[0]
    pl, pm, ph, bl = detect_percentiles(row[2], row[3], row[4], metric, city_raw)
    sample = ""
    raw.append(dict(sheet="补充-其他城市", city=city_raw, occupation=occs[0], officialName=official,
      p25=int(v_lo), p50=int(v_mid) if v_mid else "", p75=int(v_hi), mean="",
      percentileLow=pl, percentileMid=pm, percentileHigh=ph, bandLabel=bl,
      sampleLabel=sample, industryName="",
      metric=metric or f"税前应发；{bl}", dataYear=year, sourceTier=tier,
      sourceUrl=url, internalMarker=marker, note=note,
      scope="city", province=CITY_PROVINCE[city_raw]))

  # ---- 补充-京沪杭 ----
  ws = wb["补充-京沪杭"]
  for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    city = str(row[0] or "").strip()
    if city not in ("北京","上海","杭州"): continue
    label = str(row[1] or "")
    tier, tier_raw = norm_tier(row[7])
    if not tier: continue
    v_lo, _ = parse_cell(row[2]); v_mid, _ = parse_cell(row[3]); v_hi, _ = parse_cell(row[4])
    url = str(row[8] or ""); year = str(row[6] or "")
    note = str(row[10] or ""); marker = str(row[11] or ""); metric = str(row[5] or "")

    # L1 occupation bands (杭州等)
    if tier == "L1" and "→" in label and "L2" not in label:
      if v_lo is None or v_hi is None or not (v_lo < v_hi): continue
      occs = expand_occs(label)
      if not occs: continue
      official = label.split("→", 1)[1].strip()
      pl, pm, ph, bl = detect_percentiles(row[2], row[3], row[4], metric, city)
      raw.append(dict(sheet="补充-京沪杭", city=city, occupation=occs[0], officialName=official,
        p25=int(v_lo), p50=int(v_mid) if v_mid else "", p75=int(v_hi), mean="",
        percentileLow=pl, percentileMid=pm, percentileHigh=ph, bandLabel=bl,
        sampleLabel="", industryName="",
        metric=metric or f"税前应发；{bl}", dataYear=year, sourceTier="L1",
        sourceUrl=url, internalMarker=marker, note=note,
        scope="city", province=CITY_PROVINCE[city]))
      continue

    # L2 职业→行业映射（有均值）— 北京重点
    if tier == "L2" and ("L2行业" in label or "行业映射" in label):
      occs = expand_occs(label)
      if not occs: continue
      if v_mid is None: continue  # 上海无数据 → skip
      industry = industry_from_label(label)
      for occ in occs:
        raw.append(dict(sheet="补充-京沪杭", city=city, occupation=occ,
          officialName=industry,
          p25="", p50=int(v_mid), p75="", mean=int(v_mid),
          percentileLow="", percentileMid="", percentileHigh="", bandLabel="行业平均",
          sampleLabel="", industryName=industry,
          metric=metric or "税前；行业平均工资（职业→行业映射）", dataYear=year, sourceTier="L2",
          sourceUrl=url, internalMarker=marker,
          note=(note + "｜行业均值，非分位区间").strip("｜"),
          scope="city", province=CITY_PROVINCE[city]))
      continue

    # L3 应届
    if tier == "L3" and "应届" in label and v_mid and v_hi and v_mid < v_hi:
      for occ in KNOWN_OCC:
        raw.append(dict(sheet="补充-京沪杭", city=city, occupation=occ,
          officialName="2025届应届生起薪（城市混合）",
          p25=int(v_mid), p50=int(v_mid), p75=int(v_hi), mean="",
          percentileLow=50, percentileMid=50, percentileHigh=75, bandLabel="P50–P75（应届起薪）",
          sampleLabel="", industryName="",
          metric=metric or "应届起薪分位（招聘平台公开报告）", dataYear=year, sourceTier="L3",
          sourceUrl=url, internalMarker=marker, note=note,
          scope="city", province=CITY_PROVINCE[city]))

  # ---- dedupe + write ----
  seen = set(); out = []
  for row in raw:
    if row["occupation"] not in KNOWN_OCC: continue
    province = row.get("province") or CITY_PROVINCE.get(row["city"])
    if not province and row["scope"] != "region":
      print("skip unknown city", row.get("city"), file=sys.stderr); continue
    if row["scope"] == "region":
      province = row.get("province") or "川渝"
    led = ledger_for(by_url, row["sourceUrl"])
    if not led:
      print("skip no ledger", row.get("city") or row.get("scope"), row["occupation"], (row["sourceUrl"] or "")[:70], file=sys.stderr)
      continue
    tier = row["sourceTier"]
    key = "|".join([row["scope"], row.get("city") or "", province, row["occupation"], tier,
                    led["url"], str(row["p25"]), str(row["p75"]), str(row["mean"]), row.get("officialName","")])
    if key in seen: continue
    # Prefer 薪资参照 L1 over 补充 for same city×occ; prefer finer officialName for province
    if tier == "L1" and row["p25"] and row["p75"] and row["scope"] == "city":
      ix = next((i for i,o in enumerate(out) if o["city"]==row["city"] and o["occupation"]==row["occupation"]
                 and o["sourceTier"]=="L1" and o["scope"]=="city" and o["p25"] and o["p75"]), None)
      if ix is not None:
        # 补充表覆盖主表（南京等分位口径以补充表单元格标注为准）
        if row["sheet"] == "薪资参照":
          continue  # 已有行则跳过主表重复
        out.pop(ix)
    # For Hunan programmer: prefer 计算机程序设计员 S over 中类
    if row["scope"] == "province" and tier == "L1":
      ix = next((i for i,o in enumerate(out) if o["scope"]=="province" and o["province"]==province
                 and o["occupation"]==row["occupation"] and o["sourceTier"]=="L1"), None)
      if ix is not None:
        # keep the one with smaller band span or with "S" / 细类 in name
        cur = out[ix]
        prefer_new = ("S" in row["officialName"] or "程序设计员" in row["officialName"]) and "中类" in cur["officialName"]
        if not prefer_new: continue
        out.pop(ix)
    seen.add(key)
    exp = "exp-coef-v0-2026-10-24" if tier=="L1" and row.get("city") in ("深圳","广州","宁波","郑州","杭州") else ""
    out.append(dict(
      city=row.get("city") or "",
      province=province,
      scope=row["scope"],
      occupation=row["occupation"],
      officialName=row["officialName"],
      p25=row["p25"], p50=row["p50"], p75=row["p75"], mean=row["mean"],
      percentileLow=row.get("percentileLow",""),
      percentileMid=row.get("percentileMid",""),
      percentileHigh=row.get("percentileHigh",""),
      bandLabel=row.get("bandLabel",""),
      sampleLabel=row.get("sampleLabel",""),
      industryName=row.get("industryName",""),
      metric=row["metric"], dataYear=row["dataYear"], sourceTier=tier,
      sourceLedgerId=led["id"], sourceUrl=led["url"], expCoefVersion=exp,
      internalMarker=row["internalMarker"] or "示例校准", note=row["note"]))

  with OUT.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=COLS, lineterminator="\n")
    w.writeheader(); w.writerows(out)

  def g(pred): return sum(1 for x in out if pred(x))
  print(json.dumps({
    "rows": len(out),
    "tiers": {t: g(lambda x, t=t: x["sourceTier"]==t) for t in ("L1","L2","L3")},
    "scopes": {s: g(lambda x, s=s: x["scope"]==s) for s in ("city","province","region")},
    "cities": sorted({x["city"] for x in out if x["city"]}),
    "withBand": g(lambda x: x["p25"] not in ("",None) and x["p75"] not in ("",None)),
    "meanOnly": g(lambda x: (x["p25"] in ("",None) or x["p75"] in ("",None)) and x["mean"] not in ("",None)),
    "nanjingP10": [x for x in out if x["city"]=="南京"][:2],
    "wuhanProv": g(lambda x: x["scope"]=="province" and x["province"]=="湖北"),
    "hunanProv": g(lambda x: x["scope"]=="province" and x["province"]=="湖南"),
    "chuanyu": g(lambda x: x["scope"]=="region"),
    "bjL2": g(lambda x: x["city"]=="北京" and x["sourceTier"]=="L2"),
  }, ensure_ascii=False, indent=1))

if __name__ == "__main__":
  main()
