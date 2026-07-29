Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$instanceId = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL').SQLEXPRESS
$tcpRoot = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer\SuperSocketNetLib\Tcp"

Set-ItemProperty -Path "$tcpRoot\IP10" -Name Enabled -Value 1
Set-ItemProperty -Path "$tcpRoot\IPAll" -Name TcpDynamicPorts -Value ""
Set-ItemProperty -Path "$tcpRoot\IPAll" -Name TcpPort -Value "1433"

Restart-Service -Name "MSSQL`$SQLEXPRESS" -Force
Restart-Service -Name "SQLBrowser" -Force

Write-Host "SQLEXPRESS TCP/IP enabled on port 1433."
Write-Host "You can now run the Blankup backend again."
