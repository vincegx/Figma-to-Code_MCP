# 🔧 Troubleshooting Guide

> Comprehensive solutions for common issues

## Table of Contents

- [MCP Connection Issues](#mcp-connection-issues)
- [Docker Issues](#docker-issues)
- [Analysis Failures](#analysis-failures)
- [Component Rendering](#component-rendering)
- [Images & Assets](#images--assets)
- [Fonts & Typography](#fonts--typography)
- [CSS & Styling](#css--styling)
- [Performance Issues](#performance-issues)
- [API Errors](#api-errors)

---

## MCP Connection Issues

### 🔴 MCP Disconnected in Dashboard

**Symptoms:**
- Red "MCP Disconnected" indicator in dashboard
- Analysis fails with "Cannot connect to MCP server"

**Causes & Solutions:**

#### 1. Figma Desktop Not Running

```bash
# Check if Figma Desktop is running
ps aux | grep Figma  # macOS
tasklist | findstr Figma  # Windows

# Solution: Start Figma Desktop application
```

#### 2. MCP Server Not Started

```bash
# Verify MCP server is accessible
curl http://localhost:3845/mcp

# Expected: HTTP response (even 400 error means server is responding)
# Error: Connection refused = server not running
```

**Fix:**
- Open Figma Desktop
- Ensure MCP server is enabled in Figma settings
- Check Figma Console for MCP server logs

#### 3. Port 3845 Blocked

```bash
# Check if port is in use
lsof -i :3845  # macOS/Linux
netstat -ano | findstr :3845  # Windows

# If blocked by another process:
# 1. Stop that process
# 2. Restart Figma Desktop
```

#### 4. Docker Network Issues

```bash
# Test from Docker container
docker exec mcp-figma-v1 wget -O- http://host.docker.internal:3845/mcp

# If fails, check docker-compose.yml:
extra_hosts:
  - "host.docker.internal:host-gateway"  # Must be present
```

**Fix:**
```bash
# Rebuild Docker network
docker-compose down
docker-compose up --build
```

#### 5. Firewall Blocking Connection

**macOS:**
```bash
# Check firewall settings
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Allow Docker
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/Docker.app
```

**Windows:**
```powershell
# Check Windows Firewall
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Docker*"}

# Allow Docker through firewall
New-NetFirewallRule -DisplayName "Docker Desktop" -Direction Inbound -Action Allow
```

---

## Docker Issues

### Container Won't Start

**Error:** `Cannot connect to Docker daemon`

```bash
# 1. Start Docker Desktop
open -a Docker  # macOS
# Or launch Docker Desktop from Start menu (Windows)

# 2. Wait for Docker to fully start (whale icon in system tray)

# 3. Verify Docker is running
docker ps

# 4. Try starting containers
docker-compose up
```

### Port Already in Use

**Error:** `Bind for 0.0.0.0:5173 failed: port is already allocated`

```bash
# Find process using port 5173
lsof -i :5173  # macOS/Linux
netstat -ano | findstr :5173  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or change port in docker-compose.yml
ports:
  - "5174:5173"  # Use different port
```

### Volume Mount Issues

**Symptoms:**
- Hot reload not working
- Changes not reflected in container

```bash
# Check volume mounts
docker inspect mcp-figma-v1 | grep Mounts -A 20

# Verify paths exist on host
ls -la ./src
ls -la ./scripts

# Rebuild with fresh volumes
docker-compose down -v
docker-compose up --build
```

### Container Crashes on Startup

```bash
# Check logs
docker logs mcp-figma-v1

# Common causes:

# 1. Missing node_modules
docker exec mcp-figma-v1 ls /app/node_modules
# Fix: Run npm install on host, then rebuild

# 2. Syntax errors
docker exec mcp-figma-v1 npm run lint
# Fix: Fix linting errors in code

# 3. Missing environment variables
docker exec mcp-figma-v1 env
# Fix: Add to docker-compose.yml

# 4. Chromium not found (for Puppeteer)
docker exec mcp-figma-v1 which chromium
# Fix: Rebuild image (should install Chromium)
```

### Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up
docker system prune -a  # Remove unused images/containers
docker volume prune     # Remove unused volumes

# Free space in Docker Desktop settings (macOS)
# Preferences → Resources → Disk Image Size
```

---

## Analysis Failures

### Analysis Starts but Never Completes

**Symptoms:**
- Logs stop mid-analysis
- No error message
- Status remains "in progress"

**Common Causes:**

#### 1. Figma API Rate Limit

```bash
# Check usage bar in dashboard
# If >80% usage: Wait before retrying

# Workaround: Reduce chunk count
# Edit metadata.xml to limit child nodes
```

#### 2. Node.js Process Crash

```bash
# Check container logs
docker logs mcp-figma-v1

# Look for: "out of memory", "segmentation fault"

# Fix: Increase Docker memory
# Docker Desktop → Preferences → Resources → Memory
# Set to 4GB or higher
```

#### 3. Network Timeout

```bash
# Increase timeout in figma-cli.js
const timeout = 60000  // 60 seconds

# Or retry analysis
```

### Invalid Figma URL

**Error:** `Invalid Figma URL format`

**Valid Formats:**
```
✅ https://www.figma.com/design/ABC123?node-id=1-2
✅ https://www.figma.com/file/ABC123?node-id=1-2
✅ https://www.figma.com/design/ABC123/Page-Name?node-id=1-2

❌ https://www.figma.com/ABC123
❌ figma.com/design/ABC123
❌ https://www.figma.com/design/ABC123 (missing node-id)
```

**Extract from Figma:**
1. Select layer in Figma
2. Right-click → "Copy link to selection"
3. Paste into dashboard

### Node Not Found

**Error:** `Node 123:456 not found`

**Causes:**
- Node deleted in Figma
- Wrong file ID
- Wrong node ID
- Insufficient permissions

**Fix:**
```bash
# 1. Verify node exists in Figma
# Open Figma file, check layer exists

# 2. Get fresh URL
# Right-click layer → "Copy link to selection"

# 3. Check file permissions
# Ensure you have view access to Figma file
```

### Chunk Extraction Fails

**Error:** `Failed to extract chunk: Header`

**Note:** Chunking only activates when design is large/complex. Small designs use Simple Mode (no chunks).

```bash
# Check MCP server logs in Figma Console

# Common causes:

# 1. Node too complex (>1000 elements)
# Fix: Simplify design or split into smaller pieces

# 2. Invalid characters in layer name
# Fix: Rename layer in Figma (avoid: /, \, :, *, ?, ", <, >, |)

# 3. Nested components too deep
# Fix: Flatten component instances

# 4. Design might work in Simple Mode
# If design is small, it won't use chunks at all
```

---

## Component Rendering

### Component Won't Load in Dashboard

**Symptoms:**
- Preview tab shows error
- "Cannot find module" in console

```bash
# 1. Check file exists
ls src/generated/tests/node-*/Component-fixed.tsx

# 2. Check for syntax errors
docker exec mcp-figma-v1 npm run lint

# 3. Check browser console (F12)
# Look for import errors

# 4. Verify CSS exists
ls src/generated/tests/node-*/Component-fixed.css
```

**Fix:**
```bash
# Re-run processing
docker exec mcp-figma-v1 node scripts/unified-processor.js \
  src/generated/tests/node-{id}/Component.tsx \
  src/generated/tests/node-{id}/Component-fixed.tsx \
  src/generated/tests/node-{id}/metadata.xml
```

### Component Renders Incorrectly

**Symptoms:**
- Layout broken
- Elements misaligned
- Wrong colors/sizes

**Debugging Steps:**

1. **Compare with Figma Screenshot**
   ```bash
   # Open report.html
   open src/generated/tests/node-*/report.html
   ```

2. **Check Transform Stats**
   ```bash
   # View analysis.md
   cat src/generated/tests/node-*/analysis.md
   ```

3. **Inspect Generated Code**
   ```bash
   # Check Component-fixed.tsx
   cat src/generated/tests/node-*/Component-fixed.tsx
   ```

4. **Test Individual Chunks**
   ```bash
   # Check chunks-fixed/
   ls src/generated/tests/node-*/chunks-fixed/
   ```

**Common Issues:**

| Issue | Cause | Fix |
|-------|-------|-----|
| Overlapping elements | Absolute positioning | Check position-fixes transform |
| Missing background | Gradient not applied | Check post-fixes transform |
| Wrong font | Font not loaded | Check font-detection transform |
| Misaligned items | Flexbox issue | Check auto-layout transform |

### Blank Preview

**Causes:**

1. **CSS Not Loaded**
   ```bash
   # Check network tab (F12)
   # Look for 404 on .css files
   ```

2. **React Errors**
   ```bash
   # Check console (F12)
   # Look for React errors
   ```

3. **Vite Build Issues**
   ```bash
   # Restart Vite server
   docker-compose restart
   ```

---

## Images & Assets

### Images Not Appearing

**Symptoms:**
- Broken image icons
- Images show as 404

**Debugging:**

```bash
# 1. Check img/ directory exists
ls src/generated/tests/node-*/img/

# 2. Check images have proper names (not hashes)
# ✅ logo.png
# ❌ a1b2c3d4e5f6.png

# 3. Check metadata.xml has layer names
cat src/generated/tests/node-*/metadata.xml | grep name=
```

**Fix:**

```bash
# Re-organize images
docker exec mcp-figma-v1 node scripts/post-processing/organize-images.js \
  src/generated/tests/node-{id}
```

**If still failing:**

```bash
# 1. Check tmp/figma-assets/ has images
ls tmp/figma-assets/

# 2. If empty, MCP didn't download images
# Check MCP parameters in cli/config/figma-params.json:
{
  "commonParams": {
    "renderImages": true,  // Must be true
    "dirForAssetWrites": "/app/tmp/figma-assets"
  }
}

# 3. Re-run analysis
```

### SVG Icons Broken

**Symptoms:**
- SVG elements not displaying
- Console errors about SVG

**Common Causes:**

1. **Nested SVG Elements**
   ```bash
   # Check if svg-consolidation transform is enabled
   grep "svg-consolidation" scripts/config.js
   ```

2. **Invalid Attributes**
   ```bash
   # Check if svg-icon-fixes transform is enabled
   grep "svg-icon-fixes" scripts/config.js
   ```

3. **CSS Variables in Paths**
   ```bash
   # Run fix-svg-vars script
   docker exec mcp-figma-v1 node scripts/post-processing/fix-svg-vars.js \
     src/generated/tests/node-{id}
   ```

---

## Fonts & Typography

### Custom Fonts Not Loading

**Symptoms:**
- Text renders in fallback font
- Google Fonts not applied

**Debugging:**

```bash
# 1. Check Component-fixed.css has Google Fonts import
head -n 10 src/generated/tests/node-*/Component-fixed.css

# Expected:
# @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
```

**Fix if Missing:**

```bash
# 1. Check variables.json
cat src/generated/tests/node-*/variables.json | grep Font

# 2. Re-run processing with font-detection enabled
grep "font-detection" scripts/config.js
# Should show: { enabled: true }
```

**Network Issues:**

```bash
# Check if Google Fonts is accessible
curl "https://fonts.googleapis.com/css2?family=Inter:wght@400;600"

# If blocked, use self-hosted fonts
```

### Font Weights Incorrect

**Symptoms:**
- Text too thin or too bold
- Font weight doesn't match Figma

**Check Mapping:**

```javascript
// font-detection.js
const styleMap = {
  'Thin': 100,
  'ExtraLight': 200,
  'Light': 300,
  'Regular': 400,
  'Medium': 500,
  'SemiBold': 600,
  'Bold': 700,
  'ExtraBold': 800,
  'Black': 900
}
```

**Verify in Code:**

```bash
# Check inline styles
grep "fontWeight" src/generated/tests/node-*/Component-fixed.tsx
```

---

## CSS & Styling

### Tailwind Classes Not Applied

**Symptoms:**
- Components render unstyled
- Tailwind classes visible but not working

**Cause:** Arbitrary values not in safelist

**Fix:**

1. **Use Component-clean.tsx Instead**
   ```bash
   # Re-run with --clean flag
   ./cli/figma-analyze "URL" --clean

   # Use Component-clean.tsx (pure CSS, no Tailwind)
   ```

2. **Or Add Safelist to Tailwind Config**
   ```javascript
   // tailwind.config.js
   module.exports = {
     safelist: [
       { pattern: /.*/ }  // Allow all classes (not recommended for production)
     ]
   }
   ```

### CSS Variables Not Resolved

**Symptoms:**
- Styles show `var(--variable-name)` instead of values

**Check Transform:**

```bash
# Ensure css-vars transform is enabled
grep "css-vars" scripts/config.js

# Should show: { enabled: true }
```

**Verify Variables:**

```bash
# Check variables.json exists and has data
cat src/generated/tests/node-*/variables.json
```

**Re-run Processing:**

```bash
docker exec mcp-figma-v1 node scripts/unified-processor.js \
  src/generated/tests/node-{id}/Component.tsx \
  src/generated/tests/node-{id}/Component-fixed.tsx \
  src/generated/tests/node-{id}/metadata.xml
```

---

## Performance Issues

### Slow Analysis

**Symptoms:**
- Analysis takes >5 minutes
- Container uses high CPU/memory

**Optimizations:**

1. **Reduce Chunk Count**
   ```bash
   # Flatten layers in Figma
   # Fewer child nodes = faster processing
   ```

2. **Increase Docker Resources**
   ```
   Docker Desktop → Preferences → Resources
   CPU: 4+ cores
   Memory: 4+ GB
   ```

3. **Disable Unnecessary Transforms**
   ```javascript
   // scripts/config.js
   export const defaultConfig = {
     'production-cleaner': { enabled: false },  // Disable for dev
     // ... enable only what you need
   }
   ```

### Dashboard Slow to Load

**Symptoms:**
- Tests page takes long to load
- Pagination laggy

**Optimizations:**

1. **Reduce Tests Per Page**
   ```typescript
   // TestsPage.tsx
   const [perPage, setPerPage] = useState(6)  // Lower value
   ```

2. **Delete Old Tests**
   ```bash
   # Delete old tests from dashboard
   # Or manually:
   rm -rf src/generated/tests/node-*-old-timestamp
   ```

3. **Lazy Load Images**
   ```typescript
   // Use loading="lazy" on images
   <img src="..." loading="lazy" />
   ```

---

## API Errors

### 500 Internal Server Error

```bash
# Check server logs
docker logs mcp-figma-v1

# Look for stack traces

# Common causes:

# 1. Missing file
# Fix: Verify all required files exist

# 2. Invalid JSON
# Fix: Validate metadata.json, variables.json

# 3. Permission denied
# Fix: Check file permissions
chmod -R 755 src/generated/tests/
```

### 404 Not Found

**For API Endpoint:**

```bash
# Verify route exists in server.js
grep "/api/your-endpoint" server.js

# Restart server
docker-compose restart
```

**For Static File:**

```bash
# Check file exists
ls src/generated/tests/node-*/filename

# Check Vite public directory
ls public/
```

### SSE Connection Closed Prematurely

**Symptoms:**
- Real-time logs stop updating
- EventSource shows "error" state

```bash
# Check if analysis process crashed
docker logs mcp-figma-v1 | tail -50

# Increase SSE timeout in frontend
const eventSource = new EventSource(url)
eventSource.addEventListener('error', (e) => {
  console.error('SSE error:', e)
  // Implement retry logic
})
```

---

## General Debugging Tips

### Enable Verbose Logging

```bash
# Add DEBUG environment variable
docker-compose.yml:
  environment:
    - DEBUG=true

# Check logs
docker logs -f mcp-figma-v1
```

### Reset Everything

```bash
# Nuclear option: Start fresh

# 1. Stop containers
docker-compose down -v

# 2. Remove generated files
rm -rf src/generated/tests/*
rm -rf tmp/*
rm -rf data/*

# 3. Rebuild
docker-compose build --no-cache
docker-compose up
```

### Get Help

If issue persists:

1. **Check GitHub Issues**: [Issues](https://github.com/vincegx/Figma-to-Code---MCP-tools/issues)
2. **Search Discussions**: [Discussions](https://github.com/vincegx/Figma-to-Code---MCP-tools/discussions)
3. **Create New Issue**:
   - Include error message
   - Include Figma URL (if public)
   - Include Docker logs
   - Include browser console logs
   - Include system info (OS, Docker version)

---

## Next Steps

- See [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- See [DEVELOPMENT.md](DEVELOPMENT.md) for development workflow
- See [API.md](API.md) for API documentation
