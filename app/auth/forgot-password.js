import React,{useState} from "react";
import {ScrollView,Text,TextInput,StyleSheet} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import {sendRecoveryEmail} from "../../utils/passwordRecovery";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Field,
  fieldInputStyle,
  Notice,
  Screen,
  ScreenTitle
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

export default function ForgotPassword(){
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");

  async function sendResetEmail(){
    const cleanEmail=email.trim().toLowerCase();

    if(!cleanEmail || !cleanEmail.includes("@")){
      setError("Enter the email address connected to your account.");
      return;
    }

    setLoading(true);
    setError("");

    try{
      await sendRecoveryEmail(supabase,cleanEmail);
      setSent(true);
    }catch(resetError){
      console.log(resetError);
      setError(resetError.message || "The reset email could not be sent.");
    }finally{
      setLoading(false);
    }
  }

  if(sent){
    return(
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenTitle eyebrow="ACCOUNT RECOVERY" title="Check your email"/>

          {/*
            The envelope emoji is gone. An emoji carries somebody else's colour
            and weight, and on a dark instrument face it reads as a sticker --
            docs/instrument-kit.md, rule one. Empty draws the dial plate and puts
            the mail glyph in it, which is the same 16x16 grid as every other
            icon in the app.
          */}
          <Empty
            glyph="mail"
            title="A reset link is on its way"
            instruction={`If an account exists for ${email.trim()}, a password-reset link has been sent. Open the newest link on this device to choose a new password.`}
          />

          <Action
            kind="primary"
            glyph="refresh"
            label="Send another email"
            onPress={()=>setSent(false)}
          />

          <Action
            kind="quiet"
            glyph="back"
            label="Back to login"
            style={styles.link}
            onPress={()=>router.replace("/auth/login")}
          />
        </ScrollView>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle eyebrow="ACCOUNT RECOVERY" title="Forgot password?"/>
        <Text style={styles.lead}>
          Enter the email address connected to your Xplorer account. We’ll send you a
          secure link to set a new password.
        </Text>

        <Field label="Email address">
          <TextInput
            style={fieldInputStyle}
            placeholder="you@example.com"
            placeholderTextColor={INK.readoutFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </Field>

        {!!error && <Notice tone="dispute" label="Not sent">{error}</Notice>}

        <Action
          kind="primary"
          glyph="send"
          label="Send reset link"
          loading={loading}
          onPress={sendResetEmail}
        />

        <Action
          kind="quiet"
          glyph="back"
          label="Back to login"
          style={styles.link}
          onPress={()=>router.replace("/auth/login")}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:32+CREATE_HUB_CLEARANCE},
  // ScreenTitle's meta line is clamped to one line -- right for a place's
  // "2.4 KM · OPEN NOW", wrong for a sentence, which it silently truncates with
  // an ellipsis. Anything longer than a readout goes here instead.
  lead:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:-2,
    marginBottom:14
  },
  link:{marginTop:12}
});
