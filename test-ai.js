import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function run() {
  const result = streamText({ model: openai('gpt-4o-mini'), messages: [{ role: 'user', content: 'hello' }] });
  console.log(Object.keys(result));
}
run();
