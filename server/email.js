import { Resend } from 'resend';

const resend = new Resend('re_NeheHATx_Mkjr83YdTX4MDKoSKy7mrjMX');

// 生成6位数验证码
export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送验证码邮件
export async function sendVerificationEmail(email, code) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Japanese Interview Coach <noreply@japanesetalk.org>',
      to: [email],
      subject: '【Japanese Interview Coach】メール認証コード',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            メール認証コード
          </h2>
          
          <p style="font-size: 16px; color: #333; margin: 20px 0;">
            こんにちは！
          </p>
          
          <p style="font-size: 16px; color: #333; margin: 20px 0;">
            以下の認証コードを入力して、メールアドレスの確認を完了してください：
          </p>
          
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <p style="font-size: 14px; color: #666; margin-bottom: 10px;">認証コード</p>
            <p style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; margin: 0;">
              ${code}
            </p>
          </div>
          
          <p style="font-size: 14px; color: #666; margin: 20px 0;">
            ⏰ このコードは <strong>10分間</strong> 有効です。
          </p>
          
          <p style="font-size: 14px; color: #666; margin: 20px 0;">
            ⚠️ このメールに心当たりがない場合は、無視してください。
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            Japanese Interview Coach - 日本面接練習器<br/>
            © 2024 japanesetalk.org
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Send email error:', error);
      throw new Error('メール送信に失敗しました');
    }

    console.log('✅ Verification email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Send email error:', error);
    throw error;
  }
}

// 发送欢迎邮件
export async function sendWelcomeEmail(email, username) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Japanese Interview Coach <noreply@japanesetalk.org>',
      to: [email],
      subject: '【Japanese Interview Coach】アカウント登録完了',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            ようこそ！Japanese Interview Coach へ
          </h2>
          
          <p style="font-size: 16px; color: #333; margin: 20px 0;">
            ${username || 'ユーザー'}さん、こんにちは！
          </p>
          
          <p style="font-size: 16px; color: #333; margin: 20px 0;">
            アカウント登録が完了しました。日本語面接の練習を始めましょう！
          </p>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
            <h3 style="color: #2563eb; margin-top: 0;">🎯 主な機能</h3>
            <ul style="color: #333; line-height: 1.8;">
              <li>💬 面接質問の練習（HR・技術質問）</li>
              <li>🤖 AI フィードバック機能</li>
              <li>📝 履歴書アップロード・解析</li>
              <li>⭐ お気に入り保存</li>
              <li>📚 単語帳・Notion同期</li>
              <li>🎲 AI による質問自動生成</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; color: #333; margin: 20px 0;">
            初回登録で <strong style="color: #2563eb;">100 AI クレジット</strong> をプレゼント！<br/>
            さっそくログインして練習を始めましょう。
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://japanesetalk.org" 
               style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold;">
              今すぐ始める
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            Japanese Interview Coach - 日本面接練習器<br/>
            © 2024 japanesetalk.org
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Send welcome email error:', error);
      // 欢迎邮件失败不影响注册流程
      return null;
    }

    console.log('✅ Welcome email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Send welcome email error:', error);
    return null;
  }
}
