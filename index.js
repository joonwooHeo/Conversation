const express = require('express');
const dotenv = require('dotenv');
const fs = require('fs');
const { SpeechClient } = require('@google-cloud/speech');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const OpenAI = require('openai');
const playsound = require('play-sound')();

dotenv.config();

const app = express();
const port = 3000;
let audioIndex = 0;

const STT = new SpeechClient({
    keyFilename: process.env.GOOGLE_API_KEY
});
const TTS = new TextToSpeechClient({
    keyFilename: process.env.GOOGLE_API_KEY
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// STT
async function SpeechToText(audioBuffer) {
    const request = {
        audio: { content: audioBuffer.toString('base64') },
        config: { encoding: 'LINEAR16', languageCode: 'ko-KR' },
    };

    const [response] = await STT.recognize(request);
    const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n');
    return transcription;
}

// GPT
async function GPTResponse(text) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: text }],
    });
    return response.choices[0].message.content;
}

// TTS
async function TextToSpeech(text) {
    const [response] = await TTS.synthesizeSpeech({
        input: { text },
        voice: { languageCode: 'ko-KR', ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
    });

    const fileName = `response${audioIndex++}.mp3`;
    fs.writeFileSync(fileName, response.audioContent, 'base64');
    return fileName;
}

// 회화
app.post('/conversation', upload.single('audio'), async (req, res) => {
    try {
        const audioBuffer = fs.readFileSync(req.file.path);
        
        // STT
        const transcription = await SpeechToText(audioBuffer);
        console.log('User:', transcription);

        // GPT
        const gptResponse = await GPTResponse(transcription);
        console.log('GPT:', gptResponse);

        // TTS
        const audioFilePath = await TextToSpeech(gptResponse);
        
        // 음성 파일 재생
        playsound.play(audioFilePath, (err) => {
            if (err) console.error('음성 재생 중 에러:', err);
        });

        // 텍스트 응답 전송
        res.json({ transcription, gptResponse });
    } catch (error) {
        console.error('대화 중 에러:', error);
        res.status(500).json({ message: '대화 중 에러' });
    }
});

// 서버 시작
app.listen(port, () => {
    console.log(`서버가 포트 ${port}에서 실행중입니다`);
});