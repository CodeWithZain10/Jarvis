# JARVIS Speech-to-Text Engine in PowerShell
param (
    [int]$TimeoutSeconds = 8
)

Add-Type -AssemblyName System.Speech

try {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $dg = New-Object System.Speech.Recognition.DictationGrammar
    $engine.LoadGrammar($dg)
    $engine.SetInputToDefaultAudioDevice()

    $timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    $result = $engine.Recognize($timeout)

    if ($result -ne $null -and $result.Text -ne "") {
        [PSCustomObject]@{
            success = $true;
            text = $result.Text;
            confidence = $result.Confidence
        } | ConvertTo-Json -Compress
    } else {
        [PSCustomObject]@{
            success = $true;
            text = "";
            confidence = 0
        } | ConvertTo-Json -Compress
    }
} catch {
    [PSCustomObject]@{
        success = $false;
        error = $_.Exception.Message;
        text = ""
    } | ConvertTo-Json -Compress
}
