
    const firebaseConfig = {
      apiKey: "AIzaSyBGvZGWiLOZ1-KkncFreip4t4oqc01TjyE",
      authDomain: "serviportonez.firebaseapp.com",
      projectId: "serviportonez",
      storageBucket: "serviportonez.firebasestorage.app",
      messagingSenderId: "148615531792",
      appId: "1:148615531792:web:99062c41ac5f9c1ca92995"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    window.db = db;
  