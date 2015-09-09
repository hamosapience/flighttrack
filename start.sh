sudo /etc/init.d/postgresql-8.4 start
sudo /etc/init.d/redis start
sudo /etc/init.d/nginx start
pm2 stop planefinder
pm2 start /home/aisseday/flighttrack/planefinder.js --merge-logs -l /home/aisseday/flighttrack/flighttrack.log --max-memory-restart 500M

