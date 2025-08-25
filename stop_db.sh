#!/bin/bash

# Wedding Database Disconnect Script
# This script stops the Cloud SQL Proxy

echo "🔌 Wedding Database Disconnect Tool"
echo "==================================="

# Check if Cloud SQL Proxy is running
if pgrep -f "cloud_sql_proxy" > /dev/null; then
    echo "🛑 Stopping Cloud SQL Proxy..."
    
    # Kill all cloud_sql_proxy processes
    pkill -f "cloud_sql_proxy"
    
    # Wait a moment
    sleep 2
    
    # Check if successfully stopped
    if pgrep -f "cloud_sql_proxy" > /dev/null; then
        echo "⚠️  Some proxy processes might still be running. Force killing..."
        pkill -9 -f "cloud_sql_proxy"
        sleep 1
    fi
    
    # Final check
    if pgrep -f "cloud_sql_proxy" > /dev/null; then
        echo "❌ Failed to stop all proxy processes. Please check manually:"
        ps aux | grep cloud_sql_proxy | grep -v grep
    else
        echo "✅ Cloud SQL Proxy stopped successfully!"
        echo ""
        echo "📋 Status: Database connection is now closed."
        echo "🚀 To reconnect, run: ./connect_db.sh"
    fi
    
else
    echo "ℹ️  Cloud SQL Proxy is not running."
    echo "🚀 To start connection, run: ./connect_db.sh"
fi

echo ""
