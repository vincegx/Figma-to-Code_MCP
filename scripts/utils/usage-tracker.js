/**
 * Usage Tracker for Figma MCP API calls
 *
 * Tracks API call counts (exact) and provides conservative credit estimates.
 * Stores historical data for 30 days with auto-cleanup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApiLimits } from './settings-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
   * @param {number} tokensUsed - Actual tokens consumed (optional, calculated from content size)
   */
  track(toolName, tokensUsed = null) {
    // Remove 'mcp__figma-desktop__' prefix if present
    const cleanToolName = toolName.replace('mcp__figma-desktop__', '');

    // Initialize today's data structure if needed
    if (!this.data.daily[this.today].calls[cleanToolName]) {
      this.data.daily[this.today].calls[cleanToolName] = 0;
    }
    if (!this.data.daily[this.today].tokens) {
      this.data.daily[this.today].tokens = {};
    }
    if (!this.data.daily[this.today].tokens[cleanToolName]) {
      this.data.daily[this.today].tokens[cleanToolName] = 0;
    }

    // Increment counters
    this.data.daily[this.today].calls[cleanToolName]++;
    this.data.daily[this.today].totalCalls++;

    // Add actual tokens if provided
    if (tokensUsed !== null) {
      this.data.daily[this.today].tokens[cleanToolName] += tokensUsed;

      // Update total tokens
      if (!this.data.daily[this.today].totalTokens) {
        this.data.daily[this.today].totalTokens = 0;
      }
      this.data.daily[this.today].totalTokens += tokensUsed;
    }

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
    const todayData = this.data.daily[this.today] || { calls: {}, totalCalls: 0, analyses: 0, tokens: {}, totalTokens: 0 };

    const totalTokens = todayData.totalTokens || 0;

    return {
      date: this.today,
      calls: todayData.calls,
      totalCalls: todayData.totalCalls,
      analyses: todayData.analyses,
      tokens: todayData.tokens || {},
      credits: {
        min: totalTokens,
        typical: totalTokens,
        max: totalTokens,
        dailyLimit: getApiLimits().dailyTokenLimit,
        percentUsed: (totalTokens / getApiLimits().dailyTokenLimit) * 100,
        isActual: true
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
        stats.push({
          date: dateStr,
          totalCalls: dayData.totalCalls,
          analyses: dayData.analyses,
          creditsEstimate: dayData.totalTokens || 0
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
