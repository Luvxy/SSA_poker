# 싸칙 포커

숫자 카드와 사칙연산 카드로 목표 숫자에 가장 가까운 식을 만드는 2~4인 턴제 카드 게임입니다.

## 실행

로컬 테스트 서버를 켠 뒤 브라우저에서 접속합니다.

```bash
python -m http.server 4173
```

```text
http://127.0.0.1:4173/index.html
```

Firebase 설정이 없어도 `한 기기에서` 모드로 로컬 핫시트 플레이를 할 수 있습니다.

## 온라인 멀티플레이

온라인 방 기능은 Firebase Cloud Firestore를 사용합니다.

1. Firebase 콘솔에서 Web App을 만들고 Firestore Database를 활성화합니다.
2. `firebase-config.example.js`를 복사해서 `firebase-config.js`를 만듭니다.
3. Firebase 콘솔의 Web App 설정값을 `firebase-config.js`에 붙여넣습니다.
4. `firebase-config.js`는 `.gitignore`에 포함되어 있으므로 커밋되지 않습니다.
5. 브라우저를 새로고침하면 `온라인 방`에서 방 만들기와 방 참가를 사용할 수 있습니다.

```js
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

개발용 Firestore 규칙 예시입니다. 공개 방 코드 기반 프로토타입용이므로 배포 전에는 인증과 검증을 더 강화하세요.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /ssaPokerRooms/{roomCode} {
      allow read, write: if roomCode.matches('^[A-Z0-9]{6}$');
    }
  }
}
```

## 규칙

- 목표 숫자는 0부터 20 사이에서 공개됩니다.
- 1턴: 모든 플레이어가 숫자 카드 1장을 받고 베팅합니다.
- 2턴: 모든 플레이어가 사칙연산 카드 1장을 받고 베팅합니다.
- 3턴: 모든 플레이어가 숫자 카드 1장을 받고 마지막 베팅을 합니다.
- 4턴: 보유 카드로 식을 만들고 목표 숫자와 가장 가까운 플레이어가 팟을 가져갑니다.
- 같은 거리라면 무승부로 처리하고 팟을 나눕니다.

숫자 조커는 0~9 중 하나, 사칙 조커는 `+`, `-`, `×`, `÷` 중 하나로 사용할 수 있습니다.

## 구현 파일

- `index.html`: 로컬/온라인 시작 화면, 대기실, 게임 테이블
- `styles.css`: 카드 테이블 UI와 반응형 레이아웃
- `app.js`: 게임 규칙, 로컬 플레이, Firebase 방 동기화
- `firebase-config.example.js`: Firebase 설정 템플릿
