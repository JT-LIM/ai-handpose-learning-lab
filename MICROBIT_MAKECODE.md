# 🤖 덕소중학교 마퀸 제어 - MakeCode 프로그램

웹앱에서 학습된 손포즈로 마이크로비트의 마퀸을 제어하는 방법입니다.

## 📚 사전 준비

1. **마이크로비트 블루투스 설정**
   - 마이크로비트에 "Bluetooth UART" 펌웨어 설치
   - [BBC Micro:bit 공식 다운로드](https://microbit.org/download/)

2. **마퀸 연결**
   - 마이크로비트를 마퀸의 보드에 장착
   - 마이크로비트 GPIO 핀을 마퀸 모터 드라이버에 연결

## 🎯 MakeCode 프로그램

### [MakeCode 온라인 에디터](https://makecode.microbit.org)에서 다음 코드를 입력하세요:

```blocks
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let command = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (command == "forward") {
        // 앞으로 이동 (좌측 모터: 정회전, 우측 모터: 정회전)
        pins.analogWritePin(AnalogPin.P13, 255)  // 좌측 모터 전진
        pins.analogWritePin(AnalogPin.P14, 255)  // 우측 모터 전진
        pins.digitalWrite(DigitalPin.P8, 0)
        pins.digitalWrite(DigitalPin.P12, 0)
    } else if (command == "backward") {
        // 뒤로 이동 (좌측 모터: 역회전, 우측 모터: 역회전)
        pins.analogWritePin(AnalogPin.P13, 255)
        pins.analogWritePin(AnalogPin.P14, 255)
        pins.digitalWrite(DigitalPin.P8, 1)
        pins.digitalWrite(DigitalPin.P12, 1)
    } else if (command == "left") {
        // 왼쪽으로 회전 (좌측 모터: 역회전, 우측 모터: 정회전)
        pins.analogWritePin(AnalogPin.P13, 150)
        pins.analogWritePin(AnalogPin.P14, 255)
        pins.digitalWrite(DigitalPin.P8, 1)
        pins.digitalWrite(DigitalPin.P12, 0)
    } else if (command == "right") {
        // 오른쪽으로 회전 (좌측 모터: 정회전, 우측 모터: 역회전)
        pins.analogWritePin(AnalogPin.P13, 255)
        pins.analogWritePin(AnalogPin.P14, 150)
        pins.digitalWrite(DigitalPin.P8, 0)
        pins.digitalWrite(DigitalPin.P12, 1)
    } else if (command == "stop") {
        // 정지
        pins.analogWritePin(AnalogPin.P13, 0)
        pins.analogWritePin(AnalogPin.P14, 0)
    }
})

// 초기 설정
bluetooth.startUartService()
```

## 🔧 마이크로비트 핀 연결도

마퀸 모터 드라이버 기본 설정:

```
마이크로비트 핀          마퀸 모터 드라이버
─────────────────────────────────────
P13 (PWM)    ←→  좌측 모터 속도 (AIN1)
P14 (PWM)    ←→  우측 모터 속도 (BIN1)
P8 (디지털)   ←→  좌측 모터 방향 (AIN2)
P12 (디지털)  ←→  우측 모터 방향 (BIN2)
GND          ←→  GND
3V3          ←→  5V (필요시)
```

## 📝 프로그램 설명

| 명령 | 동작 | 모터 상태 |
|------|------|---------|
| **forward** | 앞으로 전진 | 좌측 정회전, 우측 정회전 |
| **backward** | 뒤로 후진 | 좌측 역회전, 우측 역회전 |
| **left** | 왼쪽으로 회전 | 좌측 역회전(약), 우측 정회전(최대) |
| **right** | 오른쪽으로 회전 | 좌측 정회전(최대), 우측 역회전(약) |
| **stop** | 즉시 정지 | 모터 정지 |

## 🚀 블루투스 연결 순서

1. **웹앱에서**:
   - 손포즈 제스처 학습 (forward, backward, left, right, stop)
   - "마이크로비트 연결" 클릭
   - 브라우저 팝업에서 마이크로비트 선택

2. **MakeCode 프로그램**:
   - 마이크로비트에 코드 다운로드
   - 전원 공급

3. **조작**:
   - "마퀸 조작 시작" 버튼 클릭
   - 학습한 손포즈 취하면 자동으로 마퀸 제어!

## ⚠️ 문제 해결

### 마퀸이 움직이지 않음
- 마이크로비트 전원 확인
- 모터 드라이버 연결 확인
- 배터리 상태 확인

### 블루투스 연결 실패
- 마이크로비트를 컴퓨터에 재연결
- 브라우저 캐시 삭제 후 새로고침
- 다른 블루투스 기기와의 간섭 확인

### 모터가 한쪽만 움직임
- 핀 연결 다시 확인
- 모터 드라이버 손상 여부 확인
- 배터리 전압 확인

## 💡 커스터마이징

마퀸의 속도와 회전 속도를 조정하려면:

- `pins.analogWritePin()` 값 변경 (0-255)
  - 255: 최대 속도
  - 150: 중간 속도
  - 0: 정지

예: 느린 전진
```blocks
pins.analogWritePin(AnalogPin.P13, 100)  // 좀 더 느리게
pins.analogWritePin(AnalogPin.P14, 100)
```

## 📖 참고자료

- [BBC Micro:bit 공식 문서](https://microbit.org/ko/guide/)
- [MakeCode 튜토리얼](https://makecode.microbit.org/tutorials)
- [마퀸 로봇 설명서](https://www.dfrobot.com/wiki/index.php/Maqueen_Microbit_Robot_Platform_(DF-ROB0057))
