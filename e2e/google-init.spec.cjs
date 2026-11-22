const{test,expect}=require('@playwright/test');
test('Google Identity y gapi Sheets/Calendar terminan de inicializar con la CSP real',async({page})=>{
 await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(r.method()!=='GET')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'production',writeEnabled:false,calendarWrites:false})});return route.continue();});
 await page.goto('/index.html');
 await expect(page.locator('#auth-btn')).toHaveAttribute('data-google-ready','true',{timeout:45000});
 await expect(page.locator('#auth-btn')).toBeVisible();
 await expect(page.locator('#modal-error')).toBeHidden();
});
