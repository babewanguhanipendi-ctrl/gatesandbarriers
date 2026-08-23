# Run this script as Administrator to allow other devices on the network
# to access the GatesandBarriers application on your machine

Write-Host "Adding Windows Firewall rules for GatesandBarriers..." -ForegroundColor Cyan

# Allow inbound TCP traffic on port 3001 (Express API server)
netsh advfirewall firewall add rule name="GatesandBarriers TCP 3001" dir=in action=allow protocol=TCP localport=3001

# Allow inbound TCP traffic on port 3000 (Webpack dev server - if used)
netsh advfirewall firewall add rule name="GatesandBarriers TCP 3000" dir=in action=allow protocol=TCP localport=3000

Write-Host "`nDone! Firewall rules added." -ForegroundColor Green
Write-Host "`nYour network IP addresses:" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } | ForEach-Object { Write-Host "  http://$($_.IPAddress):3001" -ForegroundColor Green }