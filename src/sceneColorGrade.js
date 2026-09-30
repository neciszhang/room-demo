export function colorGradeGLSL(sceneColorGrade) { return `
vec3 gradeColor=clamp(gl_FragColor.rgb,0.0,1.0);
// Preserve HSL lightness and hue while adjusting saturation.
float gradeMax=max(gradeColor.r,max(gradeColor.g,gradeColor.b));
float gradeMin=min(gradeColor.r,min(gradeColor.g,gradeColor.b));
float gradeLight=(gradeMax+gradeMin)*0.5;
float gradeChroma=gradeMax-gradeMin;
float gradeAvailable=1.0-abs(2.0*gradeLight-1.0);
if(gradeChroma>0.00001 && gradeAvailable>0.00001){
 float gradeSat=gradeChroma/gradeAvailable;
 float gradeNewSat=min(1.0,gradeSat/(1.0-${sceneColorGrade.saturation/100}));
 gradeColor=vec3(gradeLight)+(gradeColor-vec3(gradeLight))*(gradeNewSat/gradeSat);
}
// Input levels and gamma.
gradeColor=pow(clamp(gradeColor/vec3(${sceneColorGrade.inputWhite/255}),0.0,1.0),vec3(${1/sceneColorGrade.gamma}));
// Display-space brightness and contrast approximation.
// Preserve black and white; avoid the legacy uniform brightness offset.
gradeColor+=${sceneColorGrade.brightness/100}*gradeColor*(vec3(1.0)-gradeColor);
vec3 gradeA=pow(gradeColor,vec3(${1+sceneColorGrade.contrast/100}));
vec3 gradeB=pow(vec3(1.0)-gradeColor,vec3(${1+sceneColorGrade.contrast/100}));
gl_FragColor.rgb=clamp(gradeA/max(gradeA+gradeB,vec3(0.00001)),0.0,1.0);
`;
}
