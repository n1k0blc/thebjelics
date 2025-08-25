#!/bin/bash

# Wedding Database Connection Script
# This script starts the Cloud SQL Proxy and provides connection details

echo "🎊 Wedding Database Connection Tool"
echo "=================================="

# Check if Cloud SQL Proxy is already running
if pgrep -f "cloud_sql_proxy" > /dev/null; then
    echo "✅ Cloud SQL Proxy is already running!"
    
    # Show current proxy process
    echo ""
    echo "Running proxy process:"
    ps aux | grep cloud_sql_proxy | grep -v grep
    
    echo ""
    echo "🔌 Database Connection Details for DBeaver:"
    echo "=========================================="
    echo "Connection Type: PostgreSQL"
    echo "Host: 127.0.0.1"
    echo "Port: 5433"
    echo "Database: wedding_rsvp"
    echo "Username: postgres"
    echo "Password: Wedding123!"
    echo "SSL: Disabled/Off"
    echo ""
    echo "✨ You can now connect with DBeaver using these settings!"
    
else
    echo "🚀 Starting Cloud SQL Proxy..."
    
    # Check if credentials file exists
    if [ ! -f "./angelic-archery-465922-b6-5210e54c89aa.json" ]; then
        echo "❌ Error: Credentials file not found!"
        echo "Please make sure 'angelic-archery-465922-b6-5210e54c89aa.json' is in the current directory."
        exit 1
    fi
    
    # Start the proxy in background
    nohup cloud_sql_proxy angelic-archery-465922-b6:europe-west10:wedding \
        --port 5433 \
        --credentials-file ./angelic-archery-465922-b6-5210e54c89aa.json \
        > proxy.log 2>&1 &
    
    # Wait a moment for the proxy to start
    sleep 3
    
    # Check if proxy started successfully
    if pgrep -f "cloud_sql_proxy" > /dev/null; then
        echo "✅ Cloud SQL Proxy started successfully!"
        echo ""
        echo "🔌 Database Connection Details for DBeaver:"
        echo "=========================================="
        echo "Connection Type: PostgreSQL"
        echo "Host: 127.0.0.1"
        echo "Port: 5433"
        echo "Database: wedding_rsvp"
        echo "Username: postgres"
        echo "Password: Wedding123!"
        echo "SSL: Disabled/Off"
        echo ""
        echo "✨ You can now connect with DBeaver using these settings!"
        echo ""
        echo "📋 Additional Info:"
        echo "- Proxy logs are saved to: proxy.log"
        echo "- To stop the proxy: ./stop_db.sh"
        echo "- To check proxy status: ps aux | grep cloud_sql_proxy"
        
    else
        echo "❌ Failed to start Cloud SQL Proxy!"
        echo "Check proxy.log for details:"
        cat proxy.log
        exit 1
    fi
fi

echo ""
echo "🎯 Quick Test Commands:"
echo "- Check if proxy is running: ps aux | grep cloud_sql_proxy"
echo "- View proxy logs: tail -f proxy.log"
echo "- Test connection: telnet 127.0.0.1 5433"
