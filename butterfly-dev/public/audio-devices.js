// Device labels stay in the browser; an absent output label is never guessed.
export function deviceName(label=''){
 const name=label.replace(/^(默认|Default|系统默认)\s*[-—:]?\s*/i,'').trim();
 if(!name)return '';
 if(/Bluetooth|蓝牙|AirPods/i.test(name))return '蓝牙耳机';
 if(/Built-in|内建|内置|MacBook/i.test(name))return 'Mac 内置';
 return name.slice(0,50);
}
export function audioRoutes(devices=[],preferred='',trackLabel=''){
 const input=devices.find(d=>d.kind==='audioinput'&&d.deviceId===(preferred||'default'));
 const output=devices.find(d=>d.kind==='audiooutput'&&d.deviceId==='default');
 return {inputKey:input?[input.deviceId,input.groupId,input.label].join('|'):'',input:deviceName(input?.label||trackLabel),output:deviceName(output?.label)};
}
