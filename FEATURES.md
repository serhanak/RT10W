# RT10W — Özellikler

RT10 Unreal Engine 5 projesinin Three.js portudur.

---

## PlayerCharacter

| Özellik | Detay |
|---|---|
| Hareket | WASD — kamera-relatif yön hesaplama (UE5 `HandleMove` mantığı) |
| Sprint | Shift — `SprintSpeed: 9`, smooth hız geçişi (`SpeedTransitionRate`) |
| Yürüme | `WalkSpeed: 6` |
| Crouch | Ctrl — `CrouchSpeed: 3` |
| Zıplama | Space — `JumpVelocity: 7`, `AirControl: 0.25` |
| Mouse Look | Pitch/Yaw sınırlamaları (−89° / +15°), `MouseSensitivity` |
| Animasyon | Prosedürel kol/bacak sallanması, hız bazlı |
| Yer Kontağı | Fizik çarpışma normali ile tespit |
| Fizik | cannon-es Sphere body, `mass: 70`, `fixedRotation`, `linearDamping` |

---

## ModularVehicle

| Özellik | Detay |
|---|---|
| Drivetrain Formülü | `F_t = (T_e × i_x × i_0 × η_d) / r_wd` (RT10 DrivetrainCalculator) |
| Aerodinamik Drag | `F_drag = 0.5 × ρ × Cd×A × v²` |
| Şanzıman | 5 ileri + 1 geri vites, otomatik vites geçişi |
| Motor | `maxTorque: 400 Nm`, `maxRPM: 7000`, `idleRPM: 900` |
| Çekiş | RWD (arka tekerlekten çekiş) |
| Direksiyon | Hız bazlı azalma (`steerFactor = 1 - min(0.6, speed/250)`) |
| El Freni | Space tuşu |
| Geri Vites | S tuşu (durağanken otomatik geri geçiş — UE5 `HandleThrottle` mantığı) |
| Fren | S tuşu (hareket halindeyken — hız > 5 km/h) |
| Telemetri HUD | Hız (km/h), Vites, RPM gerçek zamanlı gösterim |
| Fizik | cannon-es RaycastVehicle, `mass: 1500`, süspansiyon simülasyonu |

### Drivetrain Parametreleri

| Parametre | Değer |
|---|---|
| Final Drive Ratio (i₀) | 3.42 |
| Transmission Efficiency (η_d) | 0.85 |
| Wheel Radius | 0.35 m |
| Rolling Resistance | 0.015 |
| Drag Coefficient × Area | 0.9 |
| Air Density | 1.225 kg/m³ |

### Vites Oranları

| Vites | Oran |
|---|---|
| Geri | −3.0 |
| 1 | 3.6 |
| 2 | 2.3 |
| 3 | 1.5 |
| 4 | 1.0 |
| 5 | 0.75 |

---

## Kamera Sistemi

### Oyuncu Kameraları (C tuşu ile geçiş)

| Mod | Arm Length | Pitch | FOV | Mouse Look |
|---|---|---|---|---|
| Third Person | 8 | −15° | 90° | Evet |
| First Person | 0 | 0° | 100° | Evet |
| Top Down | 30 | −89° | 60° | Hayır |
| Isometric | 25 | −55° | 60° | Hayır (Yaw: 45°) |

### Araç Kameraları (C tuşu ile geçiş)

| Mod | Arm Length | Pitch | FOV | Inherit Yaw |
|---|---|---|---|---|
| Chase | 12 | −15° | 90° | Evet |
| Cockpit | 0 | 0° | 100° | Evet |
| Hood | 0.5 | −5° | 100° | Evet |
| Cinematic | 20 | −25° | 75° | Hayır |

### Kamera Özellikleri

- Smooth transition (interpolasyon hızı: 6)
- Camera lag (UE5 `SpringArmComponent` davranışı)
- Araçta auto-center (3 saniye delay, hız: 3)
- Pitch sınırları: −89° / +15°

---

## Araç Etkileşimi

| Eylem | Detay |
|---|---|
| Araca Binme | E tuşu — araca 6 birim yakınlıkta |
| Araçtan İnme | E tuşu — hız < 10 km/h koşulu |
| Çıkış Pozisyonu | Aracın sağ tarafına 3 birim offset |
| Prompt | Yakınlıkta "Press E to enter vehicle" gösterimi |

---

## Harita

| Eleman | Detay |
|---|---|
| Pist | Oval — 2 düz bölüm (60m) + 2 yarım daire (R=30m) |
| Zemin | 400×400 çim alan |
| Bariyerler | İç ve dış pist kenarlarında fizikli bariyerler |
| Şerit Çizgileri | Kesik beyaz orta çizgi |
| Bordürler | Kırmızı-beyaz viraj bordürleri |
| Start/Finiş | Damalı bayrak çizgisi |
| Çevre | 60 rastgele ağaç |
| Spawn | Oyuncu (0, 2, 15), Araç (0, 1, −5) |
| Sis | Mesafe: 200–800 birim |

---

## Kontrol Şeması

### Oyuncu Modu

| Tuş | Eylem |
|---|---|
| W/A/S/D | Hareket |
| Space | Zıplama |
| Shift | Sprint |
| Ctrl | Crouch |
| Mouse | Bakış |
| C | Kamera modu değiştir |
| E | Araca bin |

### Araç Modu

| Tuş | Eylem |
|---|---|
| W | Gaz |
| S | Fren / Geri vites |
| A/D | Direksiyon |
| Space | El freni |
| Mouse | Bakış |
| C | Kamera modu değiştir |
| E | Araçtan in |
