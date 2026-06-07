import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

async function run() {
  const result = streamText({ model: google('gemini-1.5-flash'), messages: [{ role: 'user', content: 'hello' }] });
  console.log(Object.keys(result));
}
run();