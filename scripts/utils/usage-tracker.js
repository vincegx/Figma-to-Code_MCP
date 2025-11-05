/**
 * Usage Tracker for Figma MCP API calls
 *
 * Tracks API call counts (exact) and provides conservative credit estimates.
 * Stores historical data for 30 days with auto-cleanup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Credit estimates (conservative, based on Figma docs)
const CREDIT_ESTIMATES = {
  'get_metadata': { min: 50, typical: 50, max: 100 },
  'get_variable_defs': { min: 50, typical: 50, max: 100 },
  'get_design_context': { min: 50, typical: 200, max: 5000 },
  'get_screenshot': { min: 200, typical: 200, max: 500 },
  'get_code_connect_map': { min: 50, typical: 50, max: 100 },
  'get_figjam': { min: 50, typical: 200, max: 3000 }
};

const DAILY_LIMIT = 1200000; // Figma Professional plan daily limit
const DATA_FILE = path.join(__dirname, '../../data/figma-usage.json');

export class UsageTracker {
  constructor() {
    this.data = this.loadData();
    this.today = this.getToday();

    // Initialize today's data if needed
    if (!this.data.daily[this.today]) {
      this.data.daily[this.today] = {
        calls: {},
        totalCalls: 0,
        analyses: 0
      };
    }

    // Cleanup old data (>30 days)
    this.cleanup();
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getToday() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Load data from JSON file
   */
  loadData() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Warning: Could not load usage data: ${error.message}`);
    }

    // Return default structure
    return {
      daily: {},
      limits: {
        dailyCredits: DAILY_LIMIT,
        planType: 'professional'
      }
    };
  }

  /**
   * Save data to JSON file
   */
  saveData() {
    try {
      const dataDir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving usage data: ${error.message}`);
    }
  }

  /**
   * Cleanup data older than 30 days
   */
  cleanup() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    let cleaned = 0;
    for (const date in this.data.daily) {
      if (date < cutoffDate) {
        delete this.data.daily[date];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveData();
    }
  }

  /**
   * Track a successful MCP call
   * @param {string} toolName - MCP tool name (e.g., 'get_design_context')
   */
  track(toolName) {
    // Remove 'mcp__figma-desktop__' prefix if present
    const cleanToolName = toolName.replace('mcp__figma-desktop__', '');

    // Initialize tool count if not exists
    if (!this.data.daily[this.today].calls[cleanToolName]) {
      this.data.daily[this.today].calls[cleanToolName] = 0;
    }

    // Increment counters
    this.data.daily[this.today].calls[cleanToolName]++;
    this.data.daily[this.today].totalCalls++;

    // Save immediately
    this.saveData();
  }

  /**
   * Increment analysis counter (one analysis may have multiple MCP calls)
   */
  trackAnalysis() {
    this.data.daily[this.today].analyses++;
    this.saveData();
  }

  /**
   * Get statistics for today
   */
  getTodayStats() {
    const todayData = this.data.daily[this.today] || { calls: {}, totalCalls: 0, analyses: 0 };

    // Calculate credit estimates
    let minCredits = 0;
    let typicalCredits = 0;
    let maxCredits = 0;

    for (const [tool, count] of Object.entries(todayData.calls)) {
      const estimates = CREDIT_ESTIMATES[tool] || { min: 50, typical: 100, max: 200 };
      minCredits += count * estimates.min;
      typicalCredits += count * estimates.typical;
      maxCredits += count * estimates.max;
    }

    return {
      date: this.today,
      calls: todayData.calls,
      totalCalls: todayData.totalCalls,
      analyses: todayData.analyses,
      credits: {
        min: minCredits,
        typical: typicalCredits,
        max: maxCredits,
        dailyLimit: DAILY_LIMIT,
        percentUsed: (typicalCredits / DAILY_LIMIT) * 100
      }
    };
  }

  /**
   * Get historical stats (last N days)
   * @param {number} days - Number of days to retrieve
   */
  getHistoricalStats(days = 7) {
    const stats = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = this.data.daily[dateStr];

      if (dayData) {
        // Calculate typical credits for this day
        let typicalCredits = 0;
        for (const [tool, count] of Object.entries(dayData.calls)) {
          const estimates = CREDIT_ESTIMATES[tool] || { min: 50, typical: 100, max: 200 };
          typicalCredits += count * estimates.typical;
        }

        stats.push({
          date: dateStr,
          totalCalls: dayData.totalCalls,
          analyses: dayData.analyses,
          creditsEstimate: typicalCredits
        });
      } else {
        stats.push({
          date: dateStr,
          totalCalls: 0,
          analyses: 0,
          creditsEstimate: 0
        });
      }
    }

    return stats.reverse(); // Oldest first
  }

  /**
   * Get status message based on usage
   */
  getStatusMessage() {
    const stats = this.getTodayStats();
    const percentUsed = stats.credits.percentUsed;

    if (percentUsed < 10) {
      return { emoji: '✅', text: 'SAFE - Plenty of quota remaining', level: 'safe' };
    } else if (percentUsed < 50) {
      return { emoji: '🟢', text: 'GOOD - Moderate usage', level: 'good' };
    } else if (percentUsed < 80) {
      return { emoji: '🟡', text: 'WARNING - High usage', level: 'warning' };
    } else if (percentUsed < 95) {
      return { emoji: '🟠', text: 'CRITICAL - Near limit', level: 'critical' };
    } else {
      return { emoji: '🔴', text: 'DANGER - Likely exceeded limit', level: 'danger' };
    }
  }
}
