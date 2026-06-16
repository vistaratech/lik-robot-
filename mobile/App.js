import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Speech from 'expo-speech';
import { Camera } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

const DEFAULT_IP = '172.20.10.4:3000';

export default function App() {
  const [serverUrl, setServerUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const webViewRef = useRef(null);

  // Request permissions and load saved URL on mount
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      const savedUrl = await AsyncStorage.getItem('lik-server-url');
      if (savedUrl) {
        setServerUrl(savedUrl);
        setIsConnected(true);
      } else {
        setServerUrl(`http://${DEFAULT_IP}`);
      }
    })();
  }, []);

  const handleConnect = async () => {
    if (!serverUrl) return;
    let url = serverUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    await AsyncStorage.setItem('lik-server-url', url);
    setServerUrl(url);
    setIsConnected(true);
  };

  const handleDisconnect = async () => {
    await AsyncStorage.removeItem('lik-server-url');
    setIsConnected(false);
    Speech.stop();
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SPEAK') {
        console.log('[Native] Speaking text:', data.text);
        Speech.stop();
        Speech.speak(data.text, {
          language: data.lang || 'en-US',
          onDone: () => {
            webViewRef.current?.injectJavaScript(`
              if (window._onNativeSpeakEnd) {
                window._onNativeSpeakEnd();
              }
            `);
          },
          onError: (err) => {
            console.warn('[Native] Speech error:', err);
            webViewRef.current?.injectJavaScript(`
              if (window._onNativeSpeakEnd) {
                window._onNativeSpeakEnd();
              }
            `);
          }
        });
      }
    } catch (err) {
      console.warn('[Native] Error parsing WebView message:', err);
    }
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <Text style={styles.title}>LIK Robot Mobile Setup</Text>
          <Text style={styles.subtitle}>Enter your companion server URL below:</Text>
          
          <TextInput
            style={styles.input}
            placeholder="http://172.20.10.4:3000"
            placeholderTextColor="#666"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <TouchableOpacity style={styles.button} onPress={handleConnect}>
            <Text style={styles.buttonText}>Connect to LIK</Text>
          </TouchableOpacity>

          <Text style={styles.info}>
            Make sure your phone is connected to the same WiFi network as your companion computer.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.webviewContainer}>
      <StatusBar style="light" hidden={true} />
      <WebView
        ref={webViewRef}
        source={{ uri: serverUrl }}
        onMessage={handleMessage}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a363ff" />
            <Text style={styles.loadingText}>Booting LIK interface...</Text>
          </View>
        )}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
          alert('Connection failed! Please check your server IP and try again.');
          handleDisconnect();
        }}
        style={styles.webview}
      />
      {/* Floating Gear Button to reconnect/change IP */}
      <TouchableOpacity style={styles.floatingButton} onPress={handleDisconnect}>
        <Text style={styles.floatingButtonText}>⚙</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#12121a',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    backgroundColor: '#a363ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#a363ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    fontSize: 12,
    color: '#555',
    marginTop: 24,
    textAlign: 'center',
    lineHeight: 18,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a363ff',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 999,
  },
  floatingButtonText: {
    color: '#fff',
    fontSize: 22,
  },
});
