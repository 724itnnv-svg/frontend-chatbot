package com.nnv.chamcongvip;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidLocationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        createServerPushChannel();
    }

    private void createServerPushChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
            "server_push_high",
            getString(R.string.server_push_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.server_push_channel_description));
        channel.enableLights(true);
        channel.setLightColor(Color.rgb(22, 163, 74));
        channel.enableVibration(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(channel);
    }
}
