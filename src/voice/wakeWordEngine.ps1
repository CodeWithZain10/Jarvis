# JARVIS Wake-Word Engine in PowerShell
# Continuous loop listening for "Hey JARVIS" using System.Speech.Recognition

Add-Type -AssemblyName System.Speech

try {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $gb = New-Object System.Speech.Recognition.GrammarBuilder
    $gb.Append("Hey JARVIS")
    $g = New-Object System.Speech.Recognition.Grammar($gb)
    $engine.LoadGrammar($g)
    $engine.SetInputToDefaultAudioDevice()

    [Console]::Out.Flush()
    Write-Host "WAKEWORD_LISTENER_READY"
    [Console]::Out.Flush()

    while ($true) {
        $result = $engine.Recognize()
        if ($result -ne $null -and $result.Text -ne "" -and $result.Confidence -gt 0.3) {
            Write-Host "WAKEWORD_DETECTED"
            [Console]::Out.Flush()
        }
    }
} catch {
    Write-Host "WAKEWORD_ERROR: $($_.Exception.Message)"
    [Console]::Out.Flush()
}
