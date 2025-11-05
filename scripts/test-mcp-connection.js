import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testConnection() {
  console.log('🔌 Testing connection to Figma Desktop MCP Server...\n');

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL('http://host.docker.internal:3845/mcp')
    );

    const client = new Client(
      { name: 'test-connection', version: '1.0.0' },
      { capabilities: {} }
    );

    console.log('⏳ Connecting...');
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');

    // List tools
    console.log('📋 Listing available MCP tools:\n');
    const toolsResult = await client.listTools();

    toolsResult.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description || 'N/A'}`);
      console.log(`   Parameters:`, Object.keys(tool.inputSchema?.properties || {}).join(', ') || 'None');
      console.log('');
    });

    console.log(`\n✅ Total tools found: ${toolsResult.tools.length}`);

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Is Figma Desktop running on your host?');
    console.error('   2. Is the MCP server enabled in Figma Desktop?');
    console.error('   3. Is it running on port 3845?');
    process.exit(1);
  }
}

testConnection();
