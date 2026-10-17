export function opticalDensity(incident,transmitted,dark){
 if(![incident,transmitted,dark].every(Number.isFinite)||Math.min(incident,transmitted,dark)<0)throw new Error('Geçerli, negatif olmayan sensör değerleri girin.');
 const reference=incident-dark,signal=transmitted-dark;
 if(reference<=0)throw new Error('Referans okuma karanlık okumadan büyük olmalı.');
 if(signal<=0)throw new Error('Numune okuması karanlık okumadan büyük olmalı. Algılama sınırının altında absorbans hesaplanamaz.');
 const transmittance=signal/reference;
 if(!Number.isFinite(transmittance)||transmittance<=0)throw new Error('Değerler sayısal hesaplama aralığı dışında. Sensör birimlerini kontrol edin.');
 return {transmittance,absorbance:transmittance===1?0:-Math.log10(transmittance),warning:transmittance>1?'Numune okuması referansı aşıyor. Referans ve deney koşullarını kontrol edin; sonuç kırpılmadı.':null};
}
export function massDensity(empty,full,volume,temperature){
 if(![empty,full,volume,temperature].every(Number.isFinite)||empty<0||full<=empty||volume<=0)throw new Error('Dolu kütle boş kütleden büyük, hacim sıfırdan büyük olmalı. Sıcaklığı da girin.');
 if(temperature< -273.15)throw new Error('Geçerli bir sıcaklık girin.');
 const mass=full-empty,density=mass/volume;
 if(!Number.isFinite(density)||!Number.isFinite(density*1000))throw new Error('Değerler sayısal hesaplama aralığı dışında. Birimleri kontrol edin.');
 return {mass,volume,temperature,gramsPerMl:density,kgPerM3:density*1000};
}
