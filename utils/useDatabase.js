import { supabaseAdmin } from './initSupabaseAdmin';
import { stripe } from './initStripe';
import { toDateTime } from './helpers';

const upsertProductRecord = async (product) => {
  const productData = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description,
    image: product.images?.[0] ?? null,
    metadata: product.metadata
  };

  const { error } = await supabaseAdmin
    .from('products')
    .insert([productData], { upsert: true });
  if (error) throw error;
  console.log(`Product inserted/updated: ${product.id}`);
};

const upsertPriceRecord = async (price) => {
  const priceData = {
    id: price.id,
    product_id: price.product,
    active: price.active,
    currency: price.currency,
    description: price.nickname,
    type: price.type,
    unit_amount: price.unit_amount,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? null,
    metadata: price.metadata
  };

  const { error } = await supabaseAdmin
    .from('prices')
    .insert([priceData], { upsert: true });
  if (error) throw error;
  console.log(`Price inserted/updated: ${price.id}`);
};

const createOrRetrieveCustomer = async ({ email, uuid }) => {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('stripe_customer_id')
    .eq('id', uuid)
    .single();
  if (error) {
    // No customer record found, let's create one.
    const customerData = {
      metadata: {
        supabaseUUID: uuid
      }
    };
    if (email) customerData.email = email;
    const customer = await stripe.customers.create(customerData);
    // Now insert the customer ID into our Supabase mapping table.
    const { error: supabaseError } = await supabaseAdmin
      .from('customers')
      .insert([{ id: uuid, stripe_customer_id: customer.id }]);
    if (supabaseError) throw supabaseError;
    console.log(`New customer created and inserted for ${uuid}.`);
    return customer.id;
  }
  if (data) return data.stripe_customer_id;
};

const createTwitterToken = async ({ user_id, token_secret }) => {
  const { data, error } = await supabaseAdmin
    .from('twitter_tokens')
    .insert([{ user_id, token_secret }]);

  if (error) {
    // uhh ohh no we don't have a db connection?
    return console.log(error);
  }

  return data;
};

const getTwitterTokenFromUserId = async ({ user_id }) => {
  const { data, error } = await supabaseAdmin
    .from('twitter_tokens')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.log(error);
    return null;
  }
  return data;
};

/**
 * Copies the billing details from the payment method to the customer object.
 */
const copyBillingDetailsToCustomer = async (uuid, payment_method) => {
  const customer = payment_method.customer;
  const { name, phone, address } = payment_method.billing_details;
  await stripe.customers.update(customer, { name, phone, address });
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      billing_address: address,
      payment_method: payment_method[payment_method.type]
    })
    .eq('id', uuid);
  if (error) throw error;
};

const manageSubscriptionStatusChange = async (
  subscriptionId,
  customerId,
  createAction = false
) => {
  // Get customer's UUID from mapping table.
  const {
    data: { id: uuid },
    error: noCustomerError
  } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  if (noCustomerError) throw noCustomerError;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method']
  });
  // Upsert the latest status of the subscription object.
  const subscriptionData = {
    id: subscription.id,
    user_id: uuid,
    metadata: subscription.metadata,
    status: subscription.status,
    price_id: subscription.items.data[0].price.id,
    quantity: subscription.quantity,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at
      ? toDateTime(subscription.cancel_at)
      : null,
    canceled_at: subscription.canceled_at
      ? toDateTime(subscription.canceled_at)
      : null,
    current_period_start: toDateTime(subscription.current_period_start),
    current_period_end: toDateTime(subscription.current_period_end),
    created: toDateTime(subscription.created),
    ended_at: subscription.ended_at ? toDateTime(subscription.ended_at) : null,
    trial_start: subscription.trial_start
      ? toDateTime(subscription.trial_start)
      : null,
    trial_end: subscription.trial_end
      ? toDateTime(subscription.trial_end)
      : null
  };

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .insert([subscriptionData], { upsert: true });
  if (error) throw error;
  console.log(
    `Inserted/updated subscription [${subscription.id}] for user [${uuid}]`
  );

  // For a new subscription copy the billing details to the customer object.
  // NOTE: This is a costly operation and should happen at the very end.
  if (createAction && subscription.default_payment_method)
    await copyBillingDetailsToCustomer(
      uuid,
      subscription.default_payment_method
    );
};

const manageOneTimePayment = async (
  paymentId,
  customerId,
  createAction = false,
  dateCreated
) => {
  // Get customer's UUID from mapping table.
  const {
    data: { id: uuid },
    error: noCustomerError
  } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  if (noCustomerError) throw noCustomerError;

  const purchase = await stripe.checkout.sessions.retrieve(paymentId, {
    expand: ['line_items']
  });

  const purchaseData = {
    payment_id: paymentId,
    user_id: uuid,
    created: toDateTime(dateCreated),
    price_id: purchase.line_items.data[0].price.id //aayyyy
  };

  const { error } = await supabaseAdmin
    .from('purchases') // change this to new table01
    .insert([purchaseData], { upsert: true });
  if (error) throw error;
  console.log(`Inserted/updated purchase [${purchase.id}] for user [${uuid}]`);

  // start: handle update to convertkit
  // const data = {
  //   api_key: process.env.CONVERTKIT_API_KEY,
  //   email,
  //   fields: {
  //     twitter: user_token?.user_name,
  //     plan: subscriptionPriceId ? 'free' : 'paid'
  //   }
  // };
  // const response = await fetch(
  //   `https://api.convertkit.com/v3/forms/${formId}/subscribe`,
  //   {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify(data)
  //   }
  // );

  // end: handle convertkit

  // For a new subscription copy the billing details to the customer object.
  // NOTE: This is a costly operation and should happen at the very end.
  // if (createAction && subscription.default_payment_method)
  //   await copyBillingDetailsToCustomer(
  //     uuid,
  //     subscription.default_payment_method,
  //     customerId
  //   );
};

const addReceiptToPurchase = async (receipt_url, created, customer) => {
  const {
    data: { id: uuid },
    error: noCustomerError
  } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customer)
    .single();

  console.log('could not find supabase customer', customer);
  if (noCustomerError) throw noCustomerError;

  const receiptData = {
    user_id: uuid,
    created: toDateTime(created),
    receipt_url
  };

  const { error } = await supabaseAdmin
    .from('receipts')
    .insert([receiptData], { upsert: true });
  if (error) throw error;
};

export {
  upsertProductRecord,
  upsertPriceRecord,
  createOrRetrieveCustomer,
  manageSubscriptionStatusChange,
  createTwitterToken,
  getTwitterTokenFromUserId,
  manageOneTimePayment,
  addReceiptToPurchase
};
