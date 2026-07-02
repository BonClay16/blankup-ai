Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$instanceRoot = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQLServer"
$tcpRoot = "$instanceRoot\SuperSocketNetLib\Tcp"

# Allow SQL logins such as sa in addition to Windows authentication.
Set-ItemProperty -Path $instanceRoot -Name LoginMode -Value 2

# Enable TCP/IP and force the default SQL Server port used by the backend.
Set-ItemProperty -Path $tcpRoot -Name Enabled -Value 1
Set-ItemProperty -Path "$tcpRoot\IPAll" -Name TcpDynamicPorts -Value ""
Set-ItemProperty -Path "$tcpRoot\IPAll" -Name TcpPort -Value "1433"

Restart-Service -Name "MSSQLSERVER" -Force

Write-Host "MSSQLSERVER TCP/IP enabled on port 1433."
Write-Host "SQL authentication mode enabled. You can now run: npm start"
