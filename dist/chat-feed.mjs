export const ASSISTANT_NAME='Antony';
export function welcomeReply(question){
 const q=question.toLocaleLowerCase('tr-TR').trim().replace(/[!?.,]+$/g,'');
 if(/^(merhaba|selam|selam antony|merhaba antony|hey|hello|hi)$/.test(q))return 'Merhaba! Ben Antony. Ne konuşmak istersin? Bir konuyu birlikte açabilir, yazı hazırlayabilir veya dosyalarını inceleyebiliriz.';
 if(/^(adın ne|sen kimsin|ismin ne|nasılsın|naber)$/.test(q))return q==='nasılsın'||q==='naber'?'Buradayım, konuşmaya hazırım. Senin günün nasıl geçiyor?':'Ben Antony, Liquid Lens’in asistanıyım. Yazışabilir veya sesli konuşabiliriz. Serbest sohbet için cihazında çalışan modeli açabilirsin.';
 if(/^(teşekkürler|teşekkür ederim|sağ ol|sağol)$/.test(q))return 'Rica ederim! İstersen buradan devam edebiliriz.';
 return null;
}
export function createChatFeed(root){
 const make=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 function reset(){root.replaceChildren(make('p','Merhaba, ben Antony. Aklındakini yaz ya da sesli sohbeti aç.','chat-welcome'));}
 function begin(question){
  root.querySelector('.chat-welcome')?.remove();
  const turn=make('article','','chat-exchange'),user=make('div','','chat-message chat-user'),assistant=make('div','','chat-message chat-assistant');
  user.append(make('b','Sen'),make('p',question));assistant.append(make('b',ASSISTANT_NAME),make('p','Düşünüyorum…'));
  turn.append(user,assistant);root.append(turn);while(root.children.length>8)root.firstElementChild.remove();root.scrollTop=root.scrollHeight;
  return {finish(text,label){assistant.querySelector('p').textContent=text;assistant.append(make('small',label));root.scrollTop=root.scrollHeight;}};
 }
 reset();return {reset,begin};
}
