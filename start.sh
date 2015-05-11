sudo /etc/init.d/postgresql-8.4 start
sudo /etc/init.d/redis start
sudo /etc/init.d/nginx start
forever start /home/aisseday/flighttrack/planefinder.js --uid flighttrack 
