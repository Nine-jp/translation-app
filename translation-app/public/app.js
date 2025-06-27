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
    });

    // 音声入力
    voiceInputBtn.addEventListener('click', () => {
        if (!recognition) return;

        recognition.lang = inputLang;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceInputBtn.textContent = 'Listening...';
        voiceInputBtn.disabled = true;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            inputTextarea.value = transcript;
            voiceInputBtn.textContent = 'Voice Input';
            voiceInputBtn.disabled = false;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            showMessage(`Speech recognition error: ${event.error}`, 'error');
            voiceInputBtn.textContent = 'Voice Input';
            voiceInputBtn.disabled = false;
        };

        recognition.onend = () => {
            playBeep(400, 200); // 終了ビープ音
            voiceInputBtn.textContent = 'Voice Input';
            voiceInputBtn.disabled = false;
        };

        recognition.start();
    });

    // テキスト翻訳 (Gemini API)
    translateBtn.addEventListener('click', async () => {
        const textToTranslate = inputTextarea.value.trim();
        if (!textToTranslate) {
            showMessage('翻訳したいテキストを入力してください。');
            return;
        }

        toggleLoading(true);
        speakTranslatedTextBtn.disabled = true;
        translatedTextElement.textContent = '';

        const fromLang = (inputLang === 'ja-JP') ? '日本語' : 'メキシコスペイン語';
        const toLang = (outputLang === 'ja-JP') ? '日本語' : 'メキシコスペイン語';
        const prompt = `以下のテキストを${fromLang}から${toLang}に翻訳してください。翻訳結果のテキストだけを返してください。\n\nテキスト: "${textToTranslate}"`;

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

            const result = await response.json();
            if (result.translatedText) {
                translatedTextElement.textContent = result.translatedText;
                speakTranslatedTextBtn.disabled = false; // 翻訳が成功したら読み上げボタンを有効化
            } else {
                showMessage('Translation result not found.', 'error');
            }
        } catch (error) {
            console.error('Translation error:', error);
            showMessage(`An error occurred during translation: ${error.message}`, 'error');
        } finally {
            toggleLoading(false);
        }
    });

    // クリアボタン
    clearBtn.addEventListener('click', () => {
        inputTextarea.value = '';
        translatedTextElement.textContent = '';
        speakTranslatedTextBtn.disabled = true;
    });

    // 翻訳結果の読み上げ (Speech Synthesis API)
    speakTranslatedTextBtn.addEventListener('click', () => {
        const textToSpeak = translatedTextElement.textContent;
        if (!textToSpeak || !speechSynthesis) return;

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = outputLang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Find a suitable voice
        const voices = speechSynthesis.getVoices();
        let selectedVoice = voices.find(voice => voice.lang === outputLang);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            console.warn(`No voice found for language: ${outputLang}. Using default.`);
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