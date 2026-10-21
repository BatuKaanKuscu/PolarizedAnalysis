import {WebWorkerMLCEngineHandler} from './vendor/webllm.mjs';
const handler=new WebWorkerMLCEngineHandler();
self.onmessage=message=>handler.onmessage(message);
