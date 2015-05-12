sudo /etc/init.d/postgresql-8.4 start
sudo /etc/init.d/redis start
sudo /etc/init.d/nginx start
pm2 start /home/aisseday/flighttrack/planefinder.js -l /home/aisseday/flighttrack/flighttrack.log
