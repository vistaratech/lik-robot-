import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  StatusBar, 
  Alert 
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';

const STORAGE_KEY = '@lik_server_ip';

export default function App() {
  const [serverIp, setServerIp] = useState('');
  const [inputIp, setInputIp] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [splashTimer, setSplashTimer] = useState(3);
  
  const webViewRef = useRef(null);
  const timerRef = useRef(null);

  // Load configured IP on boot
  useEffect(() => {
    const loadIp = async () => {
      try {
        const savedIp = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedIp) {
          setServerIp(savedIp);
          setInputIp(savedIp);
          setIsConfigured(true);
          setShowSplash(true);
          startSplashCountdown();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load IP:', err);
        setLoading(false);
      }
    };
    loadIp();
    
    // Request Camera permissions on start
    Camera.requestCameraPermissionsAsync();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startSplashCountdown = () => {
    let count = 3;
    setSplashTimer(count);
    setLoading(false);

    timerRef.current = setInterval(() => {
      count -= 1;
      setSplashTimer(count);
      if (count <= 0) {
        clearInterval(timerRef.current);
        setShowSplash(false);
      }
    }, 1000);
  };

  const handleSaveIp = async () => {
    let formattedIp = inputIp.trim();
    if (!formattedIp) {
      Alert.alert('Error', 'Please enter a valid IP address or hostname.');
      return;
    }
    
    // Remove protocol and trailing slashes if user pasted a URL
    formattedIp = formattedIp.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, formattedIp);
      setServerIp(formattedIp);
      setIsConfigured(true);
      setWebError(false);
      setShowSplash(true);
      startSplashCountdown();
    } catch (err) {
      Alert.alert('Error', 'Failed to save server IP.');
    }
  };

  const handleResetIp = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setServerIp('');
      setIsConfigured(false);
      setShowSplash(false);
      setWebError(false);
    } catch (err) {
      console.error('Failed to reset IP:', err);
    }
  };

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SPEAK') {
        // Stop any current speech before starting new speech
        await Speech.stop();
        
        Speech.speak(data.text, {
          language: data.lang || 'en-US',
          onDone: () => {
            webViewRef.current?.injectJavaScript(`
              if (window._onNativeSpeakEnd) {
                window._onNativeSpeakEnd();
              }
              true;
            `);
          },
          onStopped: () => {
            webViewRef.current?.injectJavaScript(`
              if (window._onNativeSpeakEnd) {
                window._onNativeSpeakEnd();
              }
              true;
            `);
          },
          onError: (err) => {
            console.warn('Speech error:', err);
            webViewRef.current?.injectJavaScript(`
              if (window._onNativeSpeakEnd) {
                window._onNativeSpeakEnd();
              }
              true;
            `);
          }
        });
      }
    } catch (err) {
      console.error('Failed to process web message:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Initializing LIK Companion...</Text>
      </View>
    );
  }

  // 1. IP Configuration Screen
  if (!isConfigured) {
    return (
      <SafeAreaView style={styles.configContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.card}>
          <Text style={styles.title}>🤖 LIK Companion</Text>
          <Text style={styles.subtitle}>Enter your LIK Robot's server address to connect.</Text>
          
          <TextInput
            style={styles.input}
            placeholder="e.g. 192.168.1.15:3000"
            placeholderTextColor="#64748B"
            value={inputIp}
            onChangeText={setInputIp}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TouchableOpacity style={styles.button} onPress={handleSaveIp}>
            <Text style={styles.buttonText}>Connect to LIK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Connecting Splash / Countdown Screen (allows escaping back to config)
  if (showSplash) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.splashTitle}>🤖 LIK Robot</Text>
        <Text style={styles.splashStatus}>Connecting to http://{serverIp}...</Text>
        <ActivityIndicator size="large" color="#38BDF8" style={{ marginVertical: 24 }} />
        
        <Text style={styles.countdownText}>Launching in {splashTimer}s...</Text>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={handleResetIp}>
          <Text style={styles.secondaryButtonText}>Change Server IP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Error Page if connection fails
  if (webError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.errorTitle}>⚠️ Connection Failed</Text>
        <Text style={styles.errorText}>
          Could not connect to the LIK server at http://{serverIp}. Make sure the server is running on the same Wi-Fi network.
        </Text>
        
        <TouchableOpacity style={styles.button} onPress={() => setWebError(false)}>
          <Text style={styles.buttonText}>Retry Connection</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.secondaryButton, { marginTop: 12 }]} onPress={handleResetIp}>
          <Text style={styles.secondaryButtonText}>Configure Different IP</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // 4. Main WebView App Shell
  const webUrl = serverIp.startsWith('http') ? serverIp : `http://${serverIp}`;
  
  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      <WebView
        ref={webViewRef}
        source={{ uri: webUrl }}
        style={styles.webView}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onMessage={handleMessage}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        onError={() => setWebError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'System',
  },
  configContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    fontFamily: 'System',
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 20,
    fontFamily: 'System',
  },
  button: {
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  secondaryButton: {
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: 'System',
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 12,
    fontFamily: 'System',
  },
  splashStatus: {
    fontSize: 16,
    color: '#38BDF8',
    marginBottom: 12,
    fontFamily: 'System',
  },
  countdownText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 40,
    fontFamily: 'System',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 12,
    fontFamily: 'System',
  },
  errorText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'System',
  },
});
