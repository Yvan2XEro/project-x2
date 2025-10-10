// test-provider.ts
import { myProvider } from '@/lib/ai/providers';
import { generateText } from 'ai';

async function testClaude() {
  try {
    const result = await generateText({
      model: myProvider.languageModel('claude-3-5-sonnet'),
      prompt: 'Say hello!',
    });
    console.log('✅ Success:', result.text);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testClaude();