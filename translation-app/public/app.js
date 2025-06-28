document.addEventListener('DOMContentLoaded', () => {
    // ビープ音を生成して再生する関数
    function playBeep(frequency, duration) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency; // 周波数 (Hz)
        oscillator.type = 'sine'; // 波形タイプ (sine, square, sawtooth, triangle)

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + 0.01); // フェードイン
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + (duration / 1000)); // フェードアウト

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + (duration / 1000));
    }

    // DOM要素の取得
    const inputLanguageSelect = document.getElementById('inputLanguage');
    const outputLanguageSelect = document.getElementById('outputLanguage');
    const swapLanguagesBtn = document.getElementById('swapLanguagesBtn');
    const inputTextarea = document.getElementById('inputText');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const translateBtn = document.getElementById('translateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const translatedTextElement = document.getElementById('translatedText');
    const speakTranslatedTextBtn = document.getElementById('speakTranslatedTextBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    const messageBoxCloseBtn = document.getElementById('messageBoxClose');

    let inputLang = inputLanguageSelect.value;
    let outputLang = outputLanguageSelect.value;

    // --- Web Speech APIの互換性チェック ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    const speechSynthesis = window.speechSynthesis;

    if (!recognition) {
        voiceInputBtn.disabled = true;
        voiceInputBtn.textContent = 'Speech recognition not supported';
        showMessage('Your browser does not support speech recognition.', 'warning');
    } else {
        // 音声認識の初期設定
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.lang = inputLang;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            inputTextarea.value = transcript;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            showMessage(`Speech recognition error: ${event.error}`, 'error');
            // エラー時もボタンの状態を元に戻す
            voiceInputBtn.textContent = 'Voice Input';
            voiceInputBtn.disabled = false;
        };

        recognition.onend = () => {
            playBeep(400, 200); // 終了ビープ音
            voiceInputBtn.textContent = 'Voice Input';
            voiceInputBtn.disabled = false;
        };
    }

    if (!speechSynthesis) {
        speakTranslatedTextBtn.disabled = true;
        showMessage('Your browser does not support speech synthesis.', 'warning');
    }

    // --- 関数定義 ---

    // メッセージボックス表示
    function showMessage(message, type = 'info') {
        messageText.textContent = message;
        messageBox.classList.remove('hidden');
        // You can add styling based on type if you want
        // e.g., messageText.className = 'text-red-500';
    }

    // メッセージボックス非表示
    messageBoxCloseBtn.addEventListener('click', () => {
        messageBox.classList.add('hidden');
    });

    // ローディングインジケーターの表示/非表示
    function toggleLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }

    // 言語選択の変更イベントリスナー
    inputLanguageSelect.addEventListener('change', (e) => {
        inputLang = e.target.value;
        if (recognition) {
            recognition.lang = inputLang;
        }
        // 入力言語が変わったら、出力言語が同じにならないように調整
        if (inputLang === outputLang) {
            outputLang = (inputLang === 'ja-JP') ? 'es-MX' : 'ja-JP';
            outputLanguageSelect.value = outputLang;
        }
    });

    outputLanguageSelect.addEventListener('change', (e) => {
        outputLang = e.target.value;
        // 出力言語が変わったら、入力言語が同じにならないように調整
        if (outputLang === inputLang) {
            inputLang = (outputLang === 'ja-JP') ? 'es-MX' : 'ja-JP';
            inputLanguageSelect.value = inputLang;
        }
    });

    // 言語入れ替えボタン
    swapLanguagesBtn.addEventListener('click', () => {
        [inputLang, outputLang] = [outputLang, inputLang];
        inputLanguageSelect.value = inputLang;
        outputLanguageSelect.value = outputLang;
        if (recognition) {
            recognition.lang = inputLang;
        }
    });

    // 音声入力
    voiceInputBtn.addEventListener('click', () => {
        if (!recognition) return;

        voiceInputBtn.textContent = 'Listening...';
        voiceInputBtn.disabled = true;
        recognition.start();
    });

    // テキスト翻訳 (Gemini API) 関数
    async function translateText() {
        const textToTranslate = inputTextarea.value.trim();
        if (!textToTranslate) {
            showMessage('Please enter text to translate.');
            return;
        }

        toggleLoading(true);
        speakTranslatedTextBtn.disabled = true;
        translatedTextElement.textContent = '';

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: textToTranslate, from: inputLang, to: outputLang })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6);
                        try {
                            const json = JSON.parse(jsonStr);
                            if (json.candidates && json.candidates[0].content.parts[0].text) {
                                fullText += json.candidates[0].content.parts[0].text;
                                translatedTextElement.textContent = fullText;
                            }
                        } catch (e) {
                            // JSON parse error, ignore
                        }
                    }
                }
            }
            speakTranslatedTextBtn.disabled = false;

        } catch (error) {
            console.error('Translation error:', error);
            showMessage(`An error occurred during translation: ${error.message}`, 'error');
        } finally {
            toggleLoading(false);
        }
    }

    translateBtn.addEventListener('click', translateText);

    // クリアボタン
    clearBtn.addEventListener('click', () => {
        inputTextarea.value = '';
        translatedTextElement.textContent = '';
        speakTranslatedTextBtn.disabled = true;
    });

    const voices = speechSynthesis.getVoices();
        let selectedVoice = null;
        const baseOutputLang = outputLang.split('-')[0]; // 例: 'es-MX' から 'es' を抽出

        // 優先順位1: 特定の出力言語 (例: es-MX) に一致し、かつ女性の声を探す
        selectedVoice = voices.find(voice =>
            voice.lang === outputLang &&
            (voice.name.includes('Female') || voice.name.includes('Woman') || voice.name.includes('Zira') || voice.name.includes('Google US English Female') || voice.name.includes('Haruka') || voice.name.includes('Sayaka')) // 日本語の女性の声も追加
        );

        // 優先順位2: 基本の出力言語 (例: es) に一致し、かつ女性の声を探す
        if (!selectedVoice) {
            selectedVoice = voices.find(voice =>
                voice.lang.startsWith(baseOutputLang) && // 'es' で始まる音声 (es-ES, es-MXなど) を探す
                (voice.name.includes('Female') || voice.name.includes('Woman') || voice.name.includes('Zira') || voice.name.includes('Google US English Female') || voice.name.includes('Haruka') || voice.name.includes('Sayaka')) // 日本語の女性の声も追加
            );
        }

        // 優先順位3: 特定の出力言語 (例: es-MX) に一致する任意の声を探す (性別不問)
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.lang === outputLang);
        }

        // 優先順位4: 基本の出力言語 (例: es) に一致する任意の声を探す (性別不問)
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.lang.startsWith(baseOutputLang));
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            console.warn(`No suitable voice found for language: ${outputLang}. Using default.`);
        }

        speechSynthesis.speak(utterance);
    });

    // PWA Service Workerの登録
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
});