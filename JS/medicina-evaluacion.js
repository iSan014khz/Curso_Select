(function(root){
 'use strict';
 function evaluar(respuestas,preguntas){
  if(!Array.isArray(preguntas)||preguntas.length!==6||typeof respuestas!=='string'||!/^M1-[ABCD]{6}$/.test(respuestas))return null;
  const letras=respuestas.slice(3);let correctas=0;const temas={};
  preguntas.forEach((q,i)=>{const t=temas[q.tema]||(temas[q.tema]={nombre:q.nombreTema,correctas:0,total:0});t.total++;if(letras[i]===q.correcta){correctas++;t.correctas++;}});
  return {correctas,total:6,porcentaje:Math.round(correctas/6*100),temas:Object.values(temas)};
 }
 const api={evaluar};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedicinaEvaluacion=api;
})(typeof window==='undefined'?globalThis:window);
