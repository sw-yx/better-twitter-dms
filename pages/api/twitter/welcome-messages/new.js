import { supabaseAdmin } from '../../../../utils/initSupabaseAdmin';
import Twitter from 'twitter-lite';

const listDMs = async (req, res) => {
  if (req.method === 'POST') {
    const token = req.body.token;
    let {
      main_text,
      label_1,
      link_1,
      label_2,
      link_2,
      label_3,
      link_3
    } = req.body;

    try {
      const { data: user, error } = await supabaseAdmin.auth.api.getUser(token);
      if (error) throw error;

      const {
        data: subscriptionPriceId,
        error: subscriptionError
      } = await supabaseAdmin
        .from('purchases')
        .select('price_id')
        .eq('user_id', process.env.impersonate || user.id)
        .single();

      const { data: user_token, error: err } = await supabaseAdmin
        .from('twitter_tokens')
        .select('*')
        .eq('user_id', process.env.impersonate || user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (err) throw err;

      // normally gate access here, free for everyone now :)
      // if (!subscriptionPriceId || subscriptionError) {
      //   // user has not paid what do we do?
      //   // well, free account lets them create/edit/delete welcome messages
      //   // we're only letting them create ones without links though.
      //   // so strip links here prior to creating
      //   link_1 = `https://plzdm.me?ref=${user_token.user_name}`;
      //   label_1 = 'Powered by plzdm.me';
      // }

      const client = new Twitter({
        subdomain: 'api', // "api" is the default (change for other subdomains)
        version: '1.1',
        consumer_key: process.env.TWITTER_API_KEY,
        consumer_secret: process.env.TWITTER_API_SECRET_KEY,
        access_token_key: user_token.user_token,
        access_token_secret: user_token.user_token_secret
      });

      let ctas = [
        {
          type: 'web_url',
          label: label_1,
          url: link_1
        },
        {
          type: 'web_url',
          label: label_2,
          url: link_2
        },
        {
          type: 'web_url',
          label: 'Powered by PlzDM.me',
          url: 'https://plzdm.me?ref=powered-by'
        }
      ];

      ctas = ctas.filter((x) => x.label && x.url);

      let messages;
      if (ctas.length) {
        messages = await client.post('direct_messages/welcome_messages/new', {
          name: `${user_token.twitter_user_id}-${
            user_token.user_name
          }-${Date.now()}`,
          welcome_message: {
            message_data: {
              text: main_text,
              ctas: ctas
            }
          }
        });
      } else {
        messages = await client.post('direct_messages/welcome_messages/new', {
          name: `${user_token.twitter_user_id}-${
            user_token.user_name
          }-${Date.now()}`,
          welcome_message: {
            message_data: {
              text: main_text
            }
          }
        });
      }

      return res.status(200).json({ messages });
    } catch (err) {
      console.error(err);
      let errorMessage = '';
      if ('errors' in err) {
        // Twitter API error
        if (err.errors[0].code === 88) {
          // rate limit exceeded
          (errorMessage = 'Twitter rate limit will reset on'),
            new Date(err._headers.get('x-rate-limit-reset') * 1000);
          console.log(
            'Twitter rate limit will reset on',
            new Date(err._headers.get('x-rate-limit-reset') * 1000)
          );
        }
        // some other kind of error, e.g. read-only API trying to POST
        else errorMessage = err?.errors[0]?.message;
      }
      res
        .status(500)
        .json({ error: { statusCode: 500, message: errorMessage } });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
};
export default listDMs;
