const {createHandler}=require('./test.js');
const {releaseSettings}=require('../sandbox/protected-runtime.cjs');
// Inert until the server-side release settings are explicitly configured.
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{return await createHandler(releaseSettings(process.env))(req,res);}
  catch(error){return res.status(503).json({error:error.message});}
};
