using UnityEngine;
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
}
