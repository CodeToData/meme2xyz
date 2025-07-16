#!/usr/bin/env node

/**
 * Safe Development Mode for meme2xyz
 * Automatically restarts the dev server every 5 minutes to prevent browser crashes
 * Use: npm run dev-safe
 */

import { spawn } from 'child_process'
import process from 'process'

const RESTART_INTERVAL = 5 * 60 * 1000 // 5 minutes in milliseconds
const DEV_PORT = 5174

let devServer = null
let restartCount = 0

function log(message) {
  const timestamp = new Date().toLocaleTimeString()
  console.log(`[${timestamp}] 🔧 ${message}`)
}

function startDevServer() {
  return new Promise((resolve, reject) => {
    log('Starting Vite dev server...')
    
    // Kill existing server if running
    if (devServer) {
      devServer.kill('SIGTERM')
    }
    
    // Start new server
    devServer = spawn('npm', ['run', 'dev'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    })
    
    devServer.stdout.on('data', (data) => {
      const output = data.toString()
      process.stdout.write(output)
      
      // Check if server is ready
      if (output.includes('Local:') || output.includes('ready in')) {
        resolve()
      }
    })
    
    devServer.stderr.on('data', (data) => {
      process.stderr.write(data)
    })
    
    devServer.on('error', (error) => {
      log(`Server error: ${error.message}`)
      reject(error)
    })
    
    devServer.on('exit', (code, signal) => {
      if (signal !== 'SIGTERM') {
        log(`Server exited unexpectedly with code ${code}, signal ${signal}`)
      }
    })
    
    // Timeout after 30 seconds if server doesn't start
    setTimeout(() => {
      resolve() // Continue anyway
    }, 30000)
  })
}

async function restartCycle() {
  try {
    restartCount++
    log(`🔄 Restart cycle #${restartCount}`)
    
    await startDevServer()
    log(`✅ Server started successfully`)
    log(`🌐 Available at: http://localhost:${DEV_PORT}`)
    log(`⏰ Auto-restart in ${RESTART_INTERVAL / 1000} seconds...`)
    log('📝 This prevents browser memory issues from dev server')
    
    // Wait for restart interval
    await new Promise(resolve => setTimeout(resolve, RESTART_INTERVAL))
    
    log('🛑 Stopping server for scheduled restart...')
    
  } catch (error) {
    log(`❌ Error in restart cycle: ${error.message}`)
    log('⏰ Retrying in 10 seconds...')
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
}

function cleanup() {
  log('🧹 Cleaning up...')
  if (devServer) {
    devServer.kill('SIGTERM')
  }
  process.exit(0)
}

// Handle shutdown signals
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('exit', cleanup)

// Main loop
async function main() {
  log('🚀 Starting Safe Development Mode')
  log(`🔄 Server will restart every ${RESTART_INTERVAL / 1000} seconds`)
  log('Press Ctrl+C to stop')
  log('')
  
  while (true) {
    await restartCycle()
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  cleanup()
})
