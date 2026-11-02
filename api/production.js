const {createHandler}=require('./test.js');
const {releaseSettings}=require('../sandbox/protected-runtime.cjs');
const release=require('../release/activation.json');
// Release committed after native migration verification. Environment settings override it.
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const settings={};for(const key of ['HORAS_PROTECTED_PROFILE','HORAS_MIGRATION_VERIFIED','HORAS_PROTECTED_WRITES'])settings[key]=process.env[key]??release[key];
  try{return await createHandler(releaseSettings(settings))(req,res);}
  catch(error){return res.status(503).json({error:error.message});}
};
