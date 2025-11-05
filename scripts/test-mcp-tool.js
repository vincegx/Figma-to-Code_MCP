import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testGetFigmaData() {
  // Connect to MCP (via host.docker.internal from Docker)
  const transport = new StreamableHTTPClientTransport(
    new URL('http://host.docker.internal:3845/mcp')
  );

  const client = new Client(
    { name: 'test-script', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('✅ Connected to MCP\n');

  // Call get_figma_data
  const result = await client.callTool({
    name: 'get_figma_data',
    arguments: {
      fileKey: 'S7pdTdfq93HbMiVz8aAnOG',
      nodeId: '119:15308'
    }
  });

  console.log('📦 Result structure:');
  console.log('- isError:', result.isError);
  console.log('- content length:', result.content?.length);

  if (result.content && result.content.length > 0) {
    console.log('\n📄 Content[0]:');
    console.log('- type:', result.content[0].type);
    console.log('- mimeType:', result.content[0].mimeType);

    if (result.content[0].text) {
      const text = result.content[0].text;
      console.log('- text length:', text.length);

      // YAML format - look for main sections
      console.log('\n📋 YAML Structure (main sections):');
      const lines = text.split('\n');
      let currentSection = null;
      const sections = new Set();

      for (let i = 0; i < Math.min(lines.length, 200); i++) {
        const line = lines[i];
        if (line.match(/^[a-zA-Z]/)) {  // Top-level section
          const section = line.split(':')[0];
          sections.add(section);
          console.log(`  - ${section}`);
        }
      }

      // Check for specific keywords
      console.log('\n🔍 Looking for key sections:');
      console.log('  - Has "designContext":', text.includes('designContext'));
      console.log('  - Has "metadata":', text.includes('metadata'));
      console.log('  - Has "code":', text.includes('code:'));
      console.log('  - Has "screenshot":', text.includes('screenshot'));
      console.log('  - Has "variables":', text.includes('variables'));
      console.log('  - Has "nodeTree":', text.includes('nodeTree'));

      // Save full output to file
      console.log('\n💾 Saving full output to /tmp/mcp-response.yaml');
      require('fs').writeFileSync('/tmp/mcp-response.yaml', text);
    }
  }

  process.exit(0);
}

testGetFigmaData().catch(console.error);
