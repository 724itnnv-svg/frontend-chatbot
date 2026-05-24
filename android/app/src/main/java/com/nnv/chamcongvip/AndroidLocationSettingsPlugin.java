package com.nnv.chamcongvip;

import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidLocationSettings")
public class AndroidLocationSettingsPlugin extends Plugin {
    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", isLocationEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private boolean isLocationEnabled() {
        try {
            LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) return false;

            return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception ignored) {
            return false;
        }
    }
}
