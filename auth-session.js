(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AuthSession=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(storage,key,now=Date.now){
    const expiryKey=key+'_expires_at';
    function read(){const token=storage.getItem(key)||'',raw=storage.getItem(expiryKey),expiresAt=raw?Number(raw):null;return {token,expiresAt,expired:!!token&&expiresAt!==null&&(!Number.isFinite(expiresAt)||now()>=expiresAt-30000)};}
    function save(response){const seconds=Number(response?.expires_in);if(!response?.access_token||!Number.isFinite(seconds)||seconds<=0)throw new Error('Google no devolvió una conexión válida con caducidad.');const expiresAt=now()+seconds*1000;storage.setItem(key,response.access_token);storage.setItem(expiryKey,String(expiresAt));return read();}
    function clear(){storage.removeItem(key);storage.removeItem(expiryKey);}
    return {read,save,clear};
  }
  const requestOptions=(reviewPermissions=false)=>({prompt:reviewPermissions===true?'consent':''});
  const isAuthError=error=>Number(error?.status)===401||/\b401\b|invalid_token|invalid authentication credentials|token (?:has )?expired/i.test(String(error?.message||error?.error||''));
  return {create,requestOptions,isAuthError};
});
