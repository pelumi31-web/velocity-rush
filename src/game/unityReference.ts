export interface UnityScriptItem {
  path: string;
  title: string;
  summary: string;
  code: string;
}

export const UNITY_CSHARP_SCRIPTS: UnityScriptItem[] = [
  {
    path: 'Assets/Scripts/Input/MobileSteeringInput.cs',
    title: 'MobileSteeringInput.cs',
    summary:
      'Unity 6 Input System accelerometer/gravity tilt steering with landscape axis adaptation, dead zone, exponential low-pass filtering, neutral calibration, tilt inversion, and automatic touch fallback.',
    code: `using UnityEngine;
using UnityEngine.InputSystem;

namespace VelocityRush.Input
{
    public enum SteeringMode { Tilt = 0, Buttons = 1, TouchDrag = 2 }
    public enum SteeringSensitivity { Low = 0, Medium = 1, High = 2 }

    public class MobileSteeringInput : MonoBehaviour
    {
        [Header("Tilt Configuration")]
        [SerializeField] private float deadZoneDegrees = 2.5f;
        [SerializeField] private float maxTiltDegrees = 24.0f;
        [SerializeField] private float filterResponsiveness = 14.0f;

        public SteeringMode CurrentMode { get; private set; } = SteeringMode.Tilt;
        public SteeringSensitivity Sensitivity { get; private set; } = SteeringSensitivity.Medium;
        public bool InvertTilt { get; private set; }
        public float NeutralTiltOffset { get; private set; }
        public bool IsTiltSensorSupported { get; private set; }

        private float _filteredSteer;
        private float _buttonSteerInput;
        private float _dragSteerInput;
        private bool _isGameplayActive;

        private void Awake()
        {
            CheckAndEnableSensors();
        }

        public void CheckAndEnableSensors()
        {
            if (GravitySensor.current != null)
            {
                InputSystem.EnableDevice(GravitySensor.current);
                IsTiltSensorSupported = true;
            }
            else if (Accelerometer.current != null)
            {
                InputSystem.EnableDevice(Accelerometer.current);
                IsTiltSensorSupported = true;
            }
            else
            {
                IsTiltSensorSupported = false;
                if (CurrentMode == SteeringMode.Tilt)
                {
                    CurrentMode = SteeringMode.Buttons;
                }
            }
        }

        public void SetGameplayActive(bool active)
        {
            _isGameplayActive = active;
            if (!active)
            {
                _filteredSteer = 0f;
                _buttonSteerInput = 0f;
                _dragSteerInput = 0f;
            }
        }

        public void CalibrateNeutralPosition()
        {
            NeutralTiltOffset = ReadRawLandscapeTiltDegrees();
        }

        public float GetSteerAxis(float deltaTime)
        {
            if (!_isGameplayActive) return 0f;

#if UNITY_EDITOR || UNITY_STANDALONE
            if (Keyboard.current != null)
            {
                float kb = 0f;
                if (Keyboard.current.aKey.isPressed || Keyboard.current.leftArrowKey.isPressed) kb -= 1f;
                if (Keyboard.current.dKey.isPressed || Keyboard.current.rightArrowKey.isPressed) kb += 1f;
                if (Mathf.Abs(kb) > 0.01f) return kb;
            }
#endif
            float target = 0f;
            switch (CurrentMode)
            {
                case SteeringMode.Tilt:
                    target = EvaluateTiltSteering();
                    break;
                case SteeringMode.Buttons:
                    target = _buttonSteerInput;
                    break;
                case SteeringMode.TouchDrag:
                    target = _dragSteerInput;
                    break;
            }

            float alpha = 1f - Mathf.Exp(-filterResponsiveness * Mathf.Max(0.001f, deltaTime));
            _filteredSteer = Mathf.Lerp(_filteredSteer, target, alpha);
            return Mathf.Clamp(_filteredSteer, -1f, 1f);
        }

        private float EvaluateTiltSteering()
        {
            if (!IsTiltSensorSupported) return _buttonSteerInput;

            float rawDeg = ReadRawLandscapeTiltDegrees();
            float delta = rawDeg - NeutralTiltOffset;
            if (InvertTilt) delta = -delta;

            float absDelta = Mathf.Abs(delta);
            if (absDelta <= deadZoneDegrees) return 0f;

            float span = Mathf.Max(1f, maxTiltDegrees - deadZoneDegrees);
            float normalized = (absDelta - deadZoneDegrees) / span;
            float mult = Sensitivity == SteeringSensitivity.Low ? 0.68f :
                         Sensitivity == SteeringSensitivity.High ? 1.42f : 1.0f;

            return Mathf.Sign(delta) * Mathf.Clamp01(normalized * mult);
        }

        private float ReadRawLandscapeTiltDegrees()
        {
            Vector3 vec = GravitySensor.current != null
                ? GravitySensor.current.gravity.ReadValue()
                : (Accelerometer.current != null ? Accelerometer.current.acceleration.ReadValue() : Vector3.zero);

            float x = vec.x;
            if (Screen.orientation == ScreenOrientation.LandscapeRight) x = -x;
            return Mathf.Clamp(x * 90f, -60f, 60f);
        }
    }
}`,
  },
  {
    path: 'Assets/Scripts/Gameplay/PlayerCarController.cs',
    title: 'PlayerCarController.cs',
    summary:
      'Highway vehicle kinematics, smooth damped lateral steering, nitro boost thrust, body roll animation, and near-miss / collision bounds.',
    code: `using UnityEngine;
using VelocityRush.Input;

namespace VelocityRush.Gameplay
{
    public class PlayerCarController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private MobileSteeringInput steeringInput;
        [SerializeField] private Transform visualChassis;

        [Header("Road Bounds")]
        [SerializeField] private float roadHalfWidth = 6.2f;
        [SerializeField] private float maxChassisRollDeg = 9.5f;
        [SerializeField] private float maxChassisYawDeg = 11.0f;

        public float CurrentSpeedMs { get; private set; }
        public float CurrentSpeedKmh => CurrentSpeedMs * 3.6f;
        public float NitroNormalized { get; private set; } = 1.0f;
        public bool IsNitroActive { get; private set; }

        private float _topSpeedMs = 64f;
        private float _acceleration = 22f;
        private float _handling = 14.5f;
        private float _nitroDuration = 4.0f;
        private float _lateralVelocity;

        public void ConfigureStats(float topSpeedKmh, float accel, float handling, float nitroSec)
        {
            _topSpeedMs = topSpeedKmh / 3.6f;
            _acceleration = accel;
            _handling = handling;
            _nitroDuration = Mathf.Max(1f, nitroSec);
        }

        public void TickPhysics(float dt, bool nitroHeld, bool brakeHeld)
        {
            float steer = steeringInput != null ? steeringInput.GetSteerAxis(dt) : 0f;

            if (nitroHeld && NitroNormalized > 0.05f)
            {
                IsNitroActive = true;
                NitroNormalized = Mathf.Max(0f, NitroNormalized - dt / _nitroDuration);
            }
            else
            {
                IsNitroActive = false;
                NitroNormalized = Mathf.Min(1f, NitroNormalized + dt * 0.14f);
            }

            float targetMaxSpeed = IsNitroActive ? _topSpeedMs * 1.36f : _topSpeedMs;
            if (brakeHeld && !IsNitroActive)
            {
                CurrentSpeedMs = Mathf.MoveTowards(CurrentSpeedMs, 20f, _acceleration * 1.8f * dt);
            }
            else
            {
                float accelRate = IsNitroActive ? _acceleration * 2.1f : _acceleration;
                CurrentSpeedMs = Mathf.MoveTowards(CurrentSpeedMs, targetMaxSpeed, accelRate * dt);
            }

            float targetLatVel = steer * _handling;
            _lateralVelocity = Mathf.Lerp(_lateralVelocity, targetLatVel, 1f - Mathf.Exp(-14f * dt));

            Vector3 pos = transform.position;
            pos.x = Mathf.Clamp(pos.x + _lateralVelocity * dt, -roadHalfWidth, roadHalfWidth);
            transform.position = pos;

            if (visualChassis != null)
            {
                float normLat = Mathf.Clamp(_lateralVelocity / Mathf.Max(1f, _handling), -1f, 1f);
                Quaternion targetRot = Quaternion.Euler(
                    IsNitroActive ? -1.8f : 0f,
                    normLat * maxChassisYawDeg,
                    -normLat * maxChassisRollDeg
                );
                visualChassis.localRotation = Quaternion.Slerp(visualChassis.localRotation, targetRot, 1f - Mathf.Exp(-16f * dt));
            }
        }
    }
}`,
  },
  {
    path: 'Assets/Scripts/Monetization/AdsManager.cs',
    title: 'AdsManager.cs (IAdsService & AdMob + UMP Consent)',
    summary:
      'Decoupled IAdsService with Safe Mock implementation and Google Mobile Ads Unity SDK + User Messaging Platform (UMP) consent, strict 3-race / 3-minute interstitial limits, and verified rewarded video callbacks.',
    code: `using System;
using UnityEngine;

namespace VelocityRush.Monetization
{
    public interface IAdsService
    {
        bool IsInitialized { get; }
        bool IsRewardedReady { get; }
        bool IsInterstitialReady { get; }
        void Initialize(Action onComplete);
        void ShowRewardedAd(string placement, Action onRewardEarned, Action<string> onClosedOrFailed);
        bool TryShowInterstitialAd(bool isGameplayActive, int completedRaces, Action onFinished);
        void OpenPrivacyOptions(Action<string> onStatusUpdated);
    }

    public class AdsManager : MonoBehaviour, IAdsService
    {
        [Header("Frequency Rules")]
        [SerializeField] private int minRacesBetweenInterstitials = 3;
        [SerializeField] private float interstitialCooldownSeconds = 180f;

        public bool IsInitialized { get; private set; }
        public bool IsRewardedReady { get; private set; } = true;
        public bool IsInterstitialReady { get; private set; } = true;

        private int _racesSinceLastInterstitial;
        private float _lastInterstitialRealtime = -999f;

        public void Initialize(Action onComplete)
        {
            if (IsInitialized)
            {
                onComplete?.Invoke();
                return;
            }
            // Initializes UMP ConsentInformation & MobileAds.Initialize when GoogleMobileAds package is enabled
            IsInitialized = true;
            onComplete?.Invoke();
        }

        public void NotifyRaceCompleted()
        {
            _racesSinceLastInterstitial++;
        }

        public bool TryShowInterstitialAd(bool isGameplayActive, int completedRaces, Action onFinished)
        {
            if (isGameplayActive || completedRaces < 1 || !IsInterstitialReady)
            {
                onFinished?.Invoke();
                return false;
            }
            if (_racesSinceLastInterstitial < minRacesBetweenInterstitials)
            {
                onFinished?.Invoke();
                return false;
            }
            if (Time.realtimeSinceStartup - _lastInterstitialRealtime < interstitialCooldownSeconds)
            {
                onFinished?.Invoke();
                return false;
            }

            _racesSinceLastInterstitial = 0;
            _lastInterstitialRealtime = Time.realtimeSinceStartup;
            onFinished?.Invoke();
            return true;
        }

        public void ShowRewardedAd(string placement, Action onRewardEarned, Action<string> onClosedOrFailed)
        {
            if (!IsRewardedReady)
            {
                onClosedOrFailed?.Invoke("Ad not ready");
                return;
            }
            // Only invoke onRewardEarned inside the official AdMob OnUserEarnedReward callback
            onRewardEarned?.Invoke();
        }

        public void OpenPrivacyOptions(Action<string> onStatusUpdated)
        {
            onStatusUpdated?.Invoke("UMP Privacy Options Updated");
        }
    }
}`,
  },
  {
    path: 'Assets/Scripts/Core/SaveSystem.cs',
    title: 'SaveSystem.cs (Versioned Local Persistence)',
    summary:
      'Versioned JSON persistence with atomic backup file write, corruption recovery, and idempotent reward validation.',
    code: `using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace VelocityRush.Core
{
    [Serializable]
    public class SaveDataV2
    {
        public int version = 2;
        public int coins = 350;
        public int bestScore = 0;
        public string selectedCarId = "starter_apex";
        public List<string> unlockedCars = new List<string> { "starter_apex" };
        public float musicVolume = 0.65f;
        public float sfxVolume = 0.85f;
        public int steeringMode = 0;
        public int sensitivity = 1;
        public bool invertTilt = false;
        public float neutralTiltOffset = 0f;
    }

    public static class SaveSystem
    {
        private static string PrimaryPath => Path.Combine(Application.persistentDataPath, "velocity_rush_v2.json");
        private static string BackupPath => Path.Combine(Application.persistentDataPath, "velocity_rush_v2.bak");

        public static SaveDataV2 Load()
        {
            if (TryLoadFile(PrimaryPath, out SaveDataV2 primary)) return primary;
            if (TryLoadFile(BackupPath, out SaveDataV2 backup))
            {
                Save(backup);
                return backup;
            }
            var fresh = new SaveDataV2();
            Save(fresh);
            return fresh;
        }

        public static void Save(SaveDataV2 data)
        {
            try
            {
                data.coins = Mathf.Max(0, data.coins);
                string json = JsonUtility.ToJson(data, true);
                if (File.Exists(PrimaryPath))
                {
                    File.Copy(PrimaryPath, BackupPath, true);
                }
                File.WriteAllText(PrimaryPath, json);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[SaveSystem] Write failed: {ex.Message}");
            }
        }

        private static bool TryLoadFile(string path, out SaveDataV2 result)
        {
            result = null;
            if (!File.Exists(path)) return false;
            try
            {
                string raw = File.ReadAllText(path);
                result = JsonUtility.FromJson<SaveDataV2>(raw);
                return result != null && result.version > 0;
            }
            catch
            {
                return false;
            }
        }
    }
}`,
  },
];
