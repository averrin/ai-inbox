package com.aiinbox.proxmox;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;

import java.io.IOException;
import java.security.cert.CertificateException;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class ProxmoxNetworkModule extends ReactContextBaseJavaModule {
    private final OkHttpClient unsafeClient;

    public ProxmoxNetworkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.unsafeClient = getUnsafeOkHttpClient();
    }

    @Override
    public String getName() {
        return "ProxmoxNetwork";
    }

    @ReactMethod
    public void fetchUnsafe(String url, ReadableMap headers, Promise promise) {
        Request.Builder builder = new Request.Builder().url(url);

        if (headers != null) {
            ReadableMapKeySetIterator iterator = headers.keySetIterator();
            while (iterator.hasNextKey()) {
                String key = iterator.nextKey();
                String value = headers.getString(key);
                if (value != null) {
                    builder.addHeader(key, value);
                }
            }
        }

        Request request = builder.build();

        unsafeClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                promise.reject("NETWORK_ERROR", e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                try {
                    String body = response.body() != null ? response.body().string() : "";
                    if (response.isSuccessful()) {
                        promise.resolve(body);
                    } else {
                        promise.reject("HTTP_ERROR", String.valueOf(response.code()), new Exception(body));
                    }
                } catch (Exception e) {
                    promise.reject("PARSE_ERROR", e.getMessage());
                } finally {
                    if (response != null) {
                        response.close();
                    }
                }
            }
        });
    }

    private static OkHttpClient getUnsafeOkHttpClient() {
        try {
            // Create a trust manager that does not validate certificate chains
            final TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(java.security.cert.X509Certificate[] chain, String authType) throws CertificateException {
                        }

                        @Override
                        public void checkServerTrusted(java.security.cert.X509Certificate[] chain, String authType) throws CertificateException {
                        }

                        @Override
                        public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                            return new java.security.cert.X509Certificate[]{};
                        }
                    }
            };

            // Install the all-trusting trust manager
            final SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            // Create an ssl socket factory with our all-trusting manager
            final SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            OkHttpClient.Builder builder = new OkHttpClient.Builder();
            builder.sslSocketFactory(sslSocketFactory, (X509TrustManager) trustAllCerts[0]);
            builder.hostnameVerifier(new HostnameVerifier() {
                @Override
                public boolean verify(String hostname, SSLSession session) {
                    return true;
                }
            });

            // Set timeouts
            builder.connectTimeout(30, TimeUnit.SECONDS);
            builder.readTimeout(30, TimeUnit.SECONDS);
            builder.writeTimeout(30, TimeUnit.SECONDS);

            return builder.build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
