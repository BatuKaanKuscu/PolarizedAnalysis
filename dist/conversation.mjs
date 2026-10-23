export const MAX_TURNS=8;
const followup=/^(?:bunu|bunun|bunları|bunlar|bu konuyu|bu konuda|daha kısa|daha sade|daha basit|daha ayrıntılı|basitleştir|kısalt|örnek ver|örnekle|bir örnek|devam et|peki|explain it|explain that|make it|simplify|give an example)(?:\s|[.!?]|$)/iu;
const styleOnly=/^(?:bunu\s+)?(?:daha\s+)?(?:kısa|sade|basit|ayrıntılı|basitleştir|kısalt|örnekle|örnek ver|bir örnek|explain it|simplify)/iu;
export function resolveQuestion(question,turns,enabled=true){
 const last=turns.at(-1),used=!!(enabled&&last&&followup.test(question.trim())),topic=used?(last.topic||last.question):question;
 return {used,topic,retrievalQuestion:used?((styleOnly.test(question.trim())||/çevir|translate|özetle|summarize/iu.test(question))?topic:topic.slice(0,100)+' '+question.slice(0,60)):question};
}
export function appendTurn(turns,turn){return [...turns,{question:String(turn.question).slice(0,500),answer:String(turn.answer).slice(0,3000),topic:String(turn.topic||turn.question).slice(0,500),label:String(turn.label||'Yanıt'),createdAt:Date.now()}].slice(-MAX_TURNS);}
export function withConversation(messages,turns,enabled=true,topic=''){
 if(!enabled||!turns.length)return messages;
 const history=turns.slice(-2).flatMap(t=>[{role:'user',content:t.question.slice(0,180)},{role:'assistant',content:t.answer.slice(0,220)}]);
 const current={...messages.at(-1)};if(topic)current.content+='\n\nDEVAM SORUSUNUN KONUSU (kanıt değildir): '+topic.slice(0,200);
 return [{...messages[0],content:messages[0].content+' Önceki sohbet yalnızca konuşmanın bağlamıdır; doğrulanmış kaynak değildir. Son soruyu ve bu soruda sağlanan kaynakları esas al. Eski kaynak numaralarını yeni yanıtın kaynaklarıyla karıştırma.'},...history,current];
}
