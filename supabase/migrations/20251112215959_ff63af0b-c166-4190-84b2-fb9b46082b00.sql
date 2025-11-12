-- Create user_subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan TEXT CHECK (plan IN ('mensual', 'anual')) NOT NULL,
  provider TEXT CHECK (provider IN ('stripe', 'paypal')) NOT NULL,
  status TEXT CHECK (status IN ('active', 'canceled', 'expired')) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  last_event TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  paypal_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view only their own subscriptions
CREATE POLICY "Users can view own subscriptions"
ON user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own subscriptions (for initial setup)
CREATE POLICY "Users can insert own subscriptions"
ON user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);