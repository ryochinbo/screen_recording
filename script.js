const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const previewVideo = document.getElementById('preview-video');
const recordingsList = document.getElementById('recordings-list');
const systemAudioCheckbox = document.getElementById('system-audio');
const micAudioCheckbox = document.getElementById('mic-audio');

let mediaRecorder;
let recordedBlobs;
let stream;
let audioContext;
let mixedAudioStream;

// UIの初期状態を設定
stopBtn.disabled = true;

startBtn.addEventListener('click', async () => {
    const captureSystemAudio = systemAudioCheckbox.checked;
    const captureMicAudio = micAudioCheckbox.checked;

    if (!captureSystemAudio && !captureMicAudio) {
        // 画面のみを録画
    }

    try {
        // 1. メディアストリームの取得
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: "always"
            },
            audio: captureSystemAudio ? {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } : false
        });

        let micStream = null;
        if (captureMicAudio) {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                },
                video: false
            });
        }

        // 2. 音声ストリームの合成
        const audioTracks = [];
        if (captureSystemAudio && displayStream.getAudioTracks().length > 0) {
            audioTracks.push(displayStream.getAudioTracks()[0]);
        }
        if (captureMicAudio && micStream.getAudioTracks().length > 0) {
            audioTracks.push(micStream.getAudioTracks()[0]);
        }

        const videoTracks = displayStream.getVideoTracks();

        if (audioTracks.length > 1) {
            audioContext = new AudioContext();
            const destination = audioContext.createMediaStreamDestination();

            if (captureSystemAudio && displayStream.getAudioTracks().length > 0) {
                const systemSource = audioContext.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]));
                systemSource.connect(destination);
            }
            if (captureMicAudio && micStream.getAudioTracks().length > 0) {
                const micSource = audioContext.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]]));
                micSource.connect(destination);
            }
            
            mixedAudioStream = destination.stream.getAudioTracks()[0];
            stream = new MediaStream([videoTracks[0], mixedAudioStream]);
        } else if (audioTracks.length === 1) {
            stream = new MediaStream([videoTracks[0], audioTracks[0]]);
        } else {
            stream = new MediaStream(videoTracks);
        }

        // プレビューにストリームを設定
        previewVideo.srcObject = stream;

        // 録画終了時の処理: 画面共有が停止されたら録画も止める
        displayStream.getVideoTracks()[0].addEventListener('ended', () => {
            if (!stopBtn.disabled) {
                stopRecording();
            }
        });

        // 3. 録画の開始
        recordedBlobs = [];
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm; codecs=vp9,opus'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedBlobs.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedBlobs, {
                type: 'video/webm'
            });
            const url = URL.createObjectURL(blob);
            addRecordingToList(url);
        };

        mediaRecorder.start();
        console.log("MediaRecorder started", mediaRecorder);

        // UIの更新
        startBtn.disabled = true;
        stopBtn.disabled = false;

    } catch (error) {
        console.error('Error starting recording:', error);
        alert('録画の開始に失敗しました。コンソールでエラーを確認してください。');
    }
});

stopBtn.addEventListener('click', () => {
    stopRecording();
});

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    // すべてのトラックを停止してリソースを解放
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }

    previewVideo.srcObject = null;

    // UIの更新
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

function addRecordingToList(url) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const now = new Date();
    const fileName = `recording-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}.webm`;
    
    a.href = url;
    a.download = fileName;
    a.textContent = fileName;

    const downloadButton = document.createElement('a');
    downloadButton.href = url;
    downloadButton.download = fileName;
    downloadButton.textContent = 'ダウンロード';
    downloadButton.className = 'download-link';


    li.appendChild(a);
    recordingsList.appendChild(li);

    // 初期メッセージを削除
    if (recordingsList.children.length > 0 && recordingsList.querySelector('li').textContent.includes('まだ録画ファイルはありません')) {
        recordingsList.innerHTML = '';
        recordingsList.appendChild(li);
    }
}
